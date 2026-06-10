package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExperienceSectionParserTest {

  private static final String THREE_ROLES = """
      Full Stack Software Developer Sept 2024 – Present
      Independent Developer | Dublin, Ireland
      ▪ Building and shipping three production-grade full-stack applications.
      ▪ Integrating AI features into production using Google Gemini API.
      Full Stack Software Developer Apr 2024 – Sept 2024
      Freelance Developer | Dublin, Ireland
      ▪ Delivered short-cycle React, Node.js, and Java contract work.
      ▪ Created reusable UI components in Figma.
      Software Engineer Aug 2021 – Jan 2024
      Incedo Technologies Solution Ltd (Client: Verizon) | Hyderabad, India
      ▪ Optimised Verizon's telecom search page by 67%.
      ▪ Split the monolith into reliable, independent microservices.
      """;

  @Test
  void splitIntoRoleBlocks_splitsThreeRolesOnSingleNewlines() {
    var blocks = ExperienceSectionParser.splitIntoRoleBlocks(THREE_ROLES);
    assertThat(blocks).hasSize(3);
    assertThat(blocks.get(0)).contains("Sept 2024 – Present");
    assertThat(blocks.get(1)).contains("Apr 2024 – Sept 2024");
    assertThat(blocks.get(2)).contains("Aug 2021 – Jan 2024");
  }

  @Test
  void parseRoleBlock_extractsTitleDatesCompanyAndBullets() {
    var role = ExperienceSectionParser.parseRoleBlock("""
        Full Stack Software Developer Sept 2024 – Present
        Independent Developer | Dublin, Ireland
        ▪ Built apps end to end.
        """);
    assertThat(role.title()).isEqualTo("Full Stack Software Developer");
    assertThat(role.dates()).isEqualTo("Sept 2024 – Present");
    assertThat(role.company()).isEqualTo("Independent Developer");
    assertThat(role.location()).isEqualTo("Dublin, Ireland");
    assertThat(role.bullets()).containsExactly("Built apps end to end.");
  }

  @Test
  void parseRoleBlock_splitsCompanyAndLocationWithPipe() {
    var role = ExperienceSectionParser.parseRoleBlock("""
        Software Engineer Aug 2021 – Jan 2024
        Incedo Technologies Solution Ltd (Client: Verizon) | Hyderabad, India
        ▪ Optimised search by 67%.
        """);
    assertThat(role.company()).isEqualTo("Incedo Technologies Solution Ltd (Client: Verizon)");
    assertThat(role.location()).isEqualTo("Hyderabad, India");
  }

  private static final String TWO_LINE_HEADERS = """
      Full Stack Software Developer                                                                                                                                                      Dublin, Ireland
      Freelance Developer                                                                                                                                                              April 2024 – Present
      • Delivered full-stack applications using React.js and Spring Boot.
      Key Achievements:
      • Built AI-enabled solutions.
      Software Engineer                                                                                                                                                                     Hyderabad, India
      Incedo Technologies Solutions Limited                                                                                                                August 2021 - January 2024
      • Developed enterprise applications for Verizon.
      """;

  @Test
  void splitIntoRoleBlocks_splitsTwoLineTitleAndCompanyHeaders() {
    var blocks = ExperienceSectionParser.splitIntoRoleBlocks(TWO_LINE_HEADERS);
    assertThat(blocks).hasSize(2);
    assertThat(blocks.get(0)).contains("Freelance Developer");
    assertThat(blocks.get(0)).contains("April 2024 – Present");
    assertThat(blocks.get(1)).contains("Incedo Technologies");
    assertThat(blocks.get(1)).contains("August 2021 - January 2024");
  }

  @Test
  void parseRoleBlock_parsesTwoLineTitleAndCompanyHeaders() {
    var role = ExperienceSectionParser.parseRoleBlock("""
        Full Stack Software Developer Dublin, Ireland
        Freelance Developer April 2024 – Present
        • Built SaaS products.
        """);
    assertThat(role.title()).isEqualTo("Full Stack Software Developer");
    assertThat(role.location()).isEqualTo("Dublin, Ireland");
    assertThat(role.company()).isEqualTo("Freelance Developer");
    assertThat(role.dates()).isEqualTo("April 2024 – Present");
    assertThat(role.bullets()).contains("Built SaaS products.");
  }

  @Test
  void needsRepair_detectsSummaryReplacingRoleBlocks() {
    String original = """
        Full Stack Software Developer Sept 2024 – Present
        Independent Developer | Dublin, Ireland
        ▪ Built production apps.
        Software Engineer Aug 2021 – Jan 2024
        Incedo | Hyderabad
        ▪ Optimised search by 67%.
        """;
    String rewritten =
        "Sr. Software Engineer with experience in building and shipping production-grade full-stack applications.";
    assertThat(ExperienceSectionParser.needsRepair(original, rewritten)).isTrue();
    assertThat(ExperienceSectionParser.hasRoleStructure(original)).isTrue();
    assertThat(ExperienceSectionParser.hasRoleStructure(rewritten)).isFalse();
  }
}
