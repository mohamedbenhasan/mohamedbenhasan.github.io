package com.vruguard.sentinel;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.Socket;

@CapacitorPlugin(name = "TcpClient")
public class TcpClientPlugin extends Plugin {

    private Socket socket;
    private Thread readThread;
    private boolean isRunning = false;

    @PluginMethod
    public void connect(PluginCall call) {
        String host = call.getString("host");
        Integer port = call.getInt("port");

        if (host == null || port == null) {
            call.reject("Host and port are required");
            return;
        }

        disconnectInternal();

        new Thread(() -> {
            try {
                socket = new Socket(host, port);
                isRunning = true;

                JSObject ret = new JSObject();
                ret.put("connected", true);
                notifyListeners("connected", ret);
                call.resolve(ret);

                readThread = new Thread(this::readData);
                readThread.start();
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("error", e.getMessage());
                notifyListeners("error", ret);
                call.reject("Connection failed", e);
            }
        }).start();
    }

    private void readData() {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            String line;
            while (isRunning && (line = reader.readLine()) != null) {
                JSObject ret = new JSObject();
                ret.put("data", line);
                notifyListeners("data", ret);
            }
        } catch (Exception e) {
            if (isRunning) {
                JSObject ret = new JSObject();
                ret.put("error", e.getMessage());
                notifyListeners("error", ret);
            }
        } finally {
            disconnectInternal();
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectInternal();
        call.resolve();
    }

    private void disconnectInternal() {
        isRunning = false;
        try {
            if (socket != null && !socket.isClosed()) {
                socket.close();
            }
            JSObject ret = new JSObject();
            ret.put("disconnected", true);
            notifyListeners("disconnected", ret);
        } catch (Exception e) {
            // Ignore
        }
        socket = null;
    }
}
