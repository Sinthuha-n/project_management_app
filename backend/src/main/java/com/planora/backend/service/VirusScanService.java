package com.planora.backend.service;

import com.planora.backend.exception.DocumentUploadException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

@Service
public class VirusScanService {
    private final S3StorageService storage;
    private final String host;
    private final int port;
    private final int timeoutMillis;
    private final boolean enabled;

    public VirusScanService(S3StorageService storage,
                            @Value("${app.dms.clamav.host:clamav}") String host,
                            @Value("${app.dms.clamav.port:3310}") int port,
                            @Value("${app.dms.clamav.timeout-millis:120000}") int timeoutMillis,
                            @Value("${app.dms.clamav.enabled:false}") boolean enabled) {
        this.storage = storage;
        this.host = host;
        this.port = port;
        this.timeoutMillis = timeoutMillis;
        this.enabled = enabled;
    }

    public void scanFile(String bucket, String objectKey, String fileName) {
        if (!enabled) return;
        try (InputStream input = storage.getObjectStream(bucket, objectKey);
             Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), Math.min(timeoutMillis, 10_000));
            socket.setSoTimeout(timeoutMillis);
            OutputStream output = socket.getOutputStream();
            output.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                if (read == 0) continue;
                output.write(ByteBuffer.allocate(4).putInt(read).array());
                output.write(buffer, 0, read);
            }
            output.write(new byte[] {0, 0, 0, 0});
            output.flush();
            String response = readResponse(socket.getInputStream());
            if (response.contains("FOUND")) {
                throw new DocumentUploadException("MALWARE_DETECTED",
                        "The file was rejected because malware was detected.", HttpStatus.UNPROCESSABLE_ENTITY);
            }
            if (!response.contains("OK")) {
                throw scanUnavailable("ClamAV returned an indeterminate result");
            }
        } catch (DocumentUploadException ex) {
            throw ex;
        } catch (Exception ex) {
            throw scanUnavailable("Malware scanning is temporarily unavailable");
        }
    }

    /** Compatibility overload retained for older service tests/callers. */
    public void scanFile(String objectKey, String fileName) {
        if (enabled) throw scanUnavailable("A storage bucket is required for malware scanning");
    }

    private String readResponse(InputStream input) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int value;
        while ((value = input.read()) >= 0 && value != 0 && bytes.size() < 4096) bytes.write(value);
        return bytes.toString(StandardCharsets.UTF_8);
    }

    private DocumentUploadException scanUnavailable(String message) {
        return new DocumentUploadException("SCAN_UNAVAILABLE", message, HttpStatus.SERVICE_UNAVAILABLE);
    }
}
