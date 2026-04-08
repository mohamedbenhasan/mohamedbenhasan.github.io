import { Coordinates, Route, RiskFieldGrid, GridCell } from '../types';
import { getDistance } from '../utils/geo';
import { infrastructureService } from './InfrastructureService';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

export class RoutingService {
  private riskWeight: number = 50; // Tunable weight for risk vs distance

  public setRiskWeight(weight: number) {
    this.riskWeight = weight;
  }

  /**
   * Calculates routes using both OSRM (fastest) and custom A* (safest)
   */
  async calculateRoutes(start: Coordinates, end: Coordinates, riskGrid?: RiskFieldGrid): Promise<{ safest?: Route, fastest?: Route }> {
    const fastest = await this.calculateFastestRoute(start, end);
    
    let safest: Route | undefined;
    if (riskGrid && riskGrid.cells.length > 0) {
      safest = this.calculateSafestRoute(start, end, riskGrid);
    }

    // If A* fails or grid is missing, fallback to fastest
    if (!safest && fastest) {
      safest = { ...fastest, type: 'SAFEST' };
    }

    return { safest, fastest };
  }

  private async calculateFastestRoute(start: Coordinates, end: Coordinates): Promise<Route | null> {
    try {
      const url = `${OSRM_BASE_URL}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM API Error: ${response.statusText}`);

      const data = await response.json();
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null;

      const routeData = data.routes[0];
      const coordinates: Coordinates[] = routeData.geometry.coordinates.map((coord: number[]) => ({
        lat: coord[1],
        lng: coord[0]
      }));

      return {
        coordinates,
        distance: routeData.distance,
        duration: routeData.duration,
        type: 'FASTEST'
      };
    } catch (error) {
      console.error('Failed to calculate fastest route:', error);
      return null;
    }
  }

  private calculateSafestRoute(start: Coordinates, end: Coordinates, grid: RiskFieldGrid): Route | undefined {
    const ways = infrastructureService.getWays();
    if (!ways || ways.length === 0) {
      console.warn("No infrastructure ways available for routing");
      return undefined;
    }

    // 1. Build Graph from OSM ways
    const nodes = new Map<string, { coord: Coordinates, edges: { to: string, distance: number }[] }>();
    
    const getNodeId = (coord: Coordinates) => `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;

    for (const way of ways) {
      for (let i = 0; i < way.geometry.length - 1; i++) {
        const c1 = way.geometry[i];
        const c2 = way.geometry[i+1];
        const id1 = getNodeId(c1);
        const id2 = getNodeId(c2);
        
        if (!nodes.has(id1)) nodes.set(id1, { coord: c1, edges: [] });
        if (!nodes.has(id2)) nodes.set(id2, { coord: c2, edges: [] });
        
        const dist = getDistance(c1, c2);
        
        // Add bidirectional edges
        nodes.get(id1)!.edges.push({ to: id2, distance: dist });
        nodes.get(id2)!.edges.push({ to: id1, distance: dist });
      }
    }

    if (nodes.size === 0) return undefined;

    // 2. Snap start and end to the nearest graph node
    let startNodeId = '';
    let endNodeId = '';
    let minStartDist = Infinity;
    let minEndDist = Infinity;

    for (const [id, node] of nodes.entries()) {
      const dStart = getDistance(start, node.coord);
      if (dStart < minStartDist) {
        minStartDist = dStart;
        startNodeId = id;
      }
      const dEnd = getDistance(end, node.coord);
      if (dEnd < minEndDist) {
        minEndDist = dEnd;
        endNodeId = id;
      }
    }

    if (!startNodeId || !endNodeId) return undefined;

    // Pre-calculate risk for each node to optimize A*
    const nodeRisks = new Map<string, number>();
    for (const [id, node] of nodes.entries()) {
      const cell = this.getClosestCell(node.coord, grid);
      nodeRisks.set(id, cell ? cell.riskValue : 0);
    }

    // 3. A* Search on the OSM graph
    interface AStarNodeOSM {
      id: string;
      gCost: number;
      hCost: number;
      fCost: number;
      parent?: string;
    }

    const openSet: AStarNodeOSM[] = [];
    const closedSet = new Set<string>();
    const nodeMap = new Map<string, AStarNodeOSM>();

    const startNodeOSM: AStarNodeOSM = {
      id: startNodeId,
      gCost: 0,
      hCost: getDistance(nodes.get(startNodeId)!.coord, nodes.get(endNodeId)!.coord),
      fCost: 0
    };
    startNodeOSM.fCost = startNodeOSM.gCost + startNodeOSM.hCost;

    openSet.push(startNodeOSM);
    nodeMap.set(startNodeId, startNodeOSM);

    let iterations = 0;
    const MAX_ITERATIONS = 50000;

    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // Find node with lowest fCost
      let minIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].fCost < openSet[minIndex].fCost) {
          minIndex = i;
        }
      }
      const current = openSet[minIndex];
      openSet.splice(minIndex, 1);

      closedSet.add(current.id);

      // Check if reached destination
      if (current.id === endNodeId) {
        // Reconstruct path
        const path: Coordinates[] = [];
        let currId: string | undefined = current.id;
        let totalRisk = 0;
        let pathLength = 0;

        while (currId) {
          const n = nodes.get(currId);
          if (n) {
            path.push(n.coord);
            totalRisk += nodeRisks.get(currId) || 0;
            pathLength++;
          }
          currId = nodeMap.get(currId)?.parent;
        }
        path.reverse();

        // Calculate total distance
        let distance = 0;
        for (let i = 0; i < path.length - 1; i++) {
          distance += getDistance(path[i], path[i+1]);
        }

        // Add the original start and end points to connect the snapped route
        if (getDistance(start, path[0]) > 1) {
          path.unshift(start);
          distance += getDistance(start, path[1]);
        }
        if (getDistance(end, path[path.length - 1]) > 1) {
          path.push(end);
          distance += getDistance(path[path.length - 2], end);
        }

        return {
          coordinates: path,
          distance,
          duration: distance / 1.4, // Assume walking speed ~1.4 m/s
          type: 'SAFEST',
          riskScore: pathLength > 0 ? totalRisk / pathLength : 0
        };
      }

      const graphNode = nodes.get(current.id)!;
      for (const edge of graphNode.edges) {
        if (closedSet.has(edge.to)) continue;

        const neighborGraphNode = nodes.get(edge.to)!;
        
        // Calculate risk penalty
        const riskValue = nodeRisks.get(edge.to) || 0;
        
        // Cost Function: distance + (risk_weight * risk_level)
        // We square the risk to heavily penalize high risk areas
        const riskPenalty = Math.pow(riskValue, 2) * this.riskWeight * 10;
        const movementCost = edge.distance + riskPenalty;

        const tentativeGCost = current.gCost + movementCost;

        let neighborNode = nodeMap.get(edge.to);

        if (!neighborNode) {
          neighborNode = {
            id: edge.to,
            gCost: Infinity,
            hCost: getDistance(neighborGraphNode.coord, nodes.get(endNodeId)!.coord),
            fCost: Infinity
          };
          nodeMap.set(edge.to, neighborNode);
        }

        if (tentativeGCost < neighborNode.gCost) {
          neighborNode.parent = current.id;
          neighborNode.gCost = tentativeGCost;
          neighborNode.fCost = neighborNode.gCost + neighborNode.hCost;

          if (!openSet.includes(neighborNode)) {
            openSet.push(neighborNode);
          }
        }
      }
    }

    console.warn('OSM A* failed to find a path within max iterations');
    return undefined;
  }

  private getClosestCell(coord: Coordinates, grid: RiskFieldGrid): GridCell | undefined {
    let closest: GridCell | undefined;
    let minDist = Infinity;

    for (const cell of grid.cells) {
      const dist = getDistance(coord, cell.center);
      if (dist < minDist) {
        minDist = dist;
        closest = cell;
      }
    }
    return closest;
  }
}

export const routingService = new RoutingService();
