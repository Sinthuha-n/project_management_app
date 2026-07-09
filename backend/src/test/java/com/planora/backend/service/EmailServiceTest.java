package com.planora.backend.service;

import jakarta.mail.Session;
import jakarta.mail.Multipart;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailServiceTest {

    @Test
    void sendProjectInvitationHtmlEmailUsesConfiguredFrontendBaseUrl() throws Exception {
        JavaMailSenderImpl mailSender = mock(JavaMailSenderImpl.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);

        EmailService emailService = new EmailService(mailSender, "https://app.planora.example/");

        emailService.sendProjectInvitationHtmlEmail(
                "invitee@example.com",
                "Inviter Name",
                "Apollo",
                "token with spaces+symbols");

        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        String html = htmlContent(messageCaptor.getValue());
        assertTrue(html.contains("https://app.planora.example/accept-invite?token=token+with+spaces%2Bsymbols"));
        assertTrue(html.contains("https://app.planora.example/privacy"));
        assertTrue(html.contains("https://app.planora.example/contact"));
    }

    @Test
    void sendProjectInvitationHtmlEmailUsesPlanoraProductionFrontendBaseUrl() throws Exception {
        JavaMailSenderImpl mailSender = mock(JavaMailSenderImpl.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);

        EmailService emailService = new EmailService(mailSender, "https://planora-pma.netlify.app");

        emailService.sendProjectInvitationHtmlEmail(
                "invitee@example.com",
                "Inviter Name",
                "Apollo",
                "prod-token");

        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        String html = htmlContent(messageCaptor.getValue());
        assertTrue(html.contains("https://planora-pma.netlify.app/accept-invite?token=prod-token"));
        assertTrue(html.contains("https://planora-pma.netlify.app/privacy"));
        assertTrue(html.contains("https://planora-pma.netlify.app/contact"));
    }

    @Test
    void sendProjectInvitationHtmlEmailFallsBackToLocalhostWhenBaseUrlIsBlank() throws Exception {
        JavaMailSenderImpl mailSender = mock(JavaMailSenderImpl.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);

        EmailService emailService = new EmailService(mailSender, "  ");

        emailService.sendProjectInvitationHtmlEmail(
                "invitee@example.com",
                "Inviter Name",
                "Apollo",
                "abc123");

        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        String html = htmlContent(messageCaptor.getValue());
        assertTrue(html.contains("http://localhost:3000/accept-invite?token=abc123"));
    }

    private String htmlContent(MimeMessage message) throws Exception {
        return contentText(message.getContent());
    }

    private String contentText(Object content) throws Exception {
        if (content instanceof String text) {
            return text;
        }
        Multipart multipart = (Multipart) content;
        for (int i = 0; i < multipart.getCount(); i++) {
            String text = contentText(multipart.getBodyPart(i).getContent());
            if (!text.isBlank()) {
                return text;
            }
        }
        return "";
    }
}
