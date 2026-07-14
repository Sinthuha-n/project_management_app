package com.planora.backend.service;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

import org.springframework.stereotype.Component;

import com.planora.backend.exception.BadRequestException;

/** Validates user-configured outbound HTTP targets before the server connects. */
@Component
public class OutboundUrlPolicy {

    public URI requirePublicHttpUrl(String rawUrl) {
        final URI uri;
        try {
            uri = URI.create(rawUrl == null ? "" : rawUrl.trim());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Webhook URL is invalid");
        }

        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!(scheme.equals("http") || scheme.equals("https"))
                || uri.getHost() == null
                || uri.getUserInfo() != null) {
            throw new BadRequestException("Webhook URL must be a public HTTP or HTTPS URL");
        }

        try {
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (isPrivateOrSpecial(address)) {
                    throw new BadRequestException("Webhook URL must not target a private or local address");
                }
            }
        } catch (UnknownHostException ex) {
            throw new BadRequestException("Webhook URL host could not be resolved");
        }

        return uri;
    }

    private boolean isPrivateOrSpecial(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }
        if (address instanceof Inet6Address) {
            byte firstByte = address.getAddress()[0];
            return (firstByte & 0xfe) == 0xfc; // fc00::/7 unique-local range
        }
        return false;
    }
}
