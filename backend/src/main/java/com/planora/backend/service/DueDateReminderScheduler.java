// Scheduler component responsible for triggering the daily task due date reminders.
package com.planora.backend.service;

import com.planora.backend.configuration.DueDateReminderProperties;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class DueDateReminderScheduler {

    private static final Logger logger = LoggerFactory.getLogger(DueDateReminderScheduler.class);

    private final DueDateReminderProperties reminderProperties;
    private final TaskDueDateReminderService reminderService;
    private final ScheduledJobLockService scheduledJobLockService;

    @Scheduled(
            cron = "${notifications.due-date-reminder.cron:0 0 12 * * *}",
            zone = "${notifications.due-date-reminder.timezone:UTC}"
    )
    // Executes the due date reminder process according to the configured cron schedule.
    public void dispatchDueDateReminders() {
        if (!reminderProperties.isEnabled()) {
            logger.debug("DueDateReminderScheduler: reminders are disabled.");
            return;
        }

        if (!scheduledJobLockService.tryAcquire("due-date-reminders", Duration.ofHours(2))) {
            logger.debug("Due-date reminders are already running on another instance.");
            return;
        }

        try {
            TaskDueDateReminderService.ReminderRunStats stats = reminderService.sendDueDateReminders();
            logger.info(
                    "DueDateReminderScheduler: scannedTasks={}, sent={}, dueSoon={}, overdue={}, skippedIneligible={}, skippedDisabled={}, skippedDuplicate={}",
                    stats.getScannedTasks(), stats.getSentNotifications(), stats.getSentDueSoonNotifications(),
                    stats.getSentOverdueNotifications(), stats.getSkippedIneligibleTasks(), stats.getSkippedDisabledRecipients(),
                    stats.getSkippedDuplicateNotifications());
        } finally {
            scheduledJobLockService.release("due-date-reminders");
        }
    }
}
