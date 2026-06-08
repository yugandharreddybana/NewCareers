package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectsSectionParserTest {

    @Test
    void parseEntries_pipeTitleWithLinkPlaceholder() {
        var entries = ProjectsSectionParser.parseEntries("""
            AI-Powered Task Management Application | Link
            Built a full-stack task manager with real-time updates.
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).title()).isEqualTo("AI-Powered Task Management Application");
        assertThat(entries.get(0).url()).isBlank();
        assertThat(entries.get(0).description()).containsIgnoringCase("full-stack");
    }

    @Test
    void parseEntries_techLineExtracted() {
        var entries = ProjectsSectionParser.parseEntries("""
            CareerOps Platform
            Technologies: React, Node.js, PostgreSQL
            End-to-end job matching platform.
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).title()).isEqualTo("CareerOps Platform");
        assertThat(entries.get(0).techTags()).containsExactly("React", "Node.js", "PostgreSQL");
        assertThat(entries.get(0).description()).containsIgnoringCase("job matching");
    }

    @Test
    void parseEntries_genericHeaderPromotesNextLineToTitle() {
        var entries = ProjectsSectionParser.parseEntries("""
            Project details:
            AI-Powered Task Management Application | Link
            Implemented Kanban boards and notifications.
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).title()).isEqualTo("AI-Powered Task Management Application");
        assertThat(entries.get(0).description()).containsIgnoringCase("Kanban");
    }

    @Test
    void parseEntries_threePipeTitleProjects() {
        var entries = ProjectsSectionParser.parseEntries("""
            CareerOps Platform | Link
            Job matching platform for developers.

            AI Task Manager | Link
            Full-stack task management with AI.

            Portfolio Site | Link
            Personal portfolio with blog.
            """);
        assertThat(entries).hasSize(3);
        assertThat(entries.get(0).title()).isEqualTo("CareerOps Platform");
        assertThat(entries.get(1).title()).isEqualTo("AI Task Manager");
        assertThat(entries.get(2).title()).isEqualTo("Portfolio Site");
    }

    @Test
    void parseEntries_techLineThenPipeTitle() {
        var entries = ProjectsSectionParser.parseEntries("""
            React, Node.js, PostgreSQL
            AI-Powered Task Management Application | Link
            Built Kanban boards and notifications.
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).title()).isEqualTo("AI-Powered Task Management Application");
        assertThat(entries.get(0).techTags()).contains("React", "Node.js", "PostgreSQL");
    }
}
