package com.planora.backend.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UserResponseDTO {
    private Long userId;
    private String username;
    private String fullName;
    private String email;
    private boolean verified;
    private String profilePicUrl;
    private LocalDateTime lastActive;
    // Extended profile fields
    private String firstName;
    private String lastName;
    private String contactNumber;
    private String countryCode;
    private String jobTitle;
    private String company;
    private String position;
    private String bio;
    private String githubUsername;
    private String githubEmail;
    private boolean notifyDueDateReminders;
}
