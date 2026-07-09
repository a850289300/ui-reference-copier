# Menu Structure Prompt Specification

## ADDED Requirements

### Requirement: Menu Semantic Prompting

When a structure comparison pair appears to be a menu or navigation component, the extension SHALL include a component semantic section in the structure prompt.

#### Scenario: Generic menu comparison

- **GIVEN** a reference element whose selector, role, tag, or child nodes indicate a menu/navigation area
- **AND** a current element whose selector, role, tag, or child nodes indicate a menu/navigation area
- **WHEN** the user copies the structure difference prompt
- **THEN** the prompt SHALL explain that the comparison is a menu/navigation semantic difference
- **AND** it SHALL tell the model not to directly rewrite based on `div`, `ul`, `li`, or `span` counts
- **AND** it SHALL tell the model to keep the current project's existing menu component, route config, or menu data source where possible

#### Scenario: Menu item summary

- **GIVEN** sampled child nodes with menu-like text
- **WHEN** the structure prompt is generated
- **THEN** the prompt SHALL include a concise reference menu semantic summary
- **AND** it SHALL include a concise current menu semantic summary
- **AND** it SHALL highlight likely missing or extra menu items when detectable

#### Scenario: Non-menu structures

- **GIVEN** a structure comparison pair that does not appear to be a menu/navigation component
- **WHEN** the structure prompt is generated
- **THEN** the output SHALL remain focused on the existing generic structure differences
- **AND** it SHALL NOT add menu-specific instructions.

### Requirement: Detailed DOM Data Preservation

Detailed structure prompts SHALL continue to include existing tag/role/DOM path diagnostics.

#### Scenario: Detailed menu prompt

- **GIVEN** a menu/navigation comparison
- **WHEN** the user copies detailed structure data
- **THEN** the prompt SHALL include both the new menu semantic section and the existing detailed tag, role, selector, DOM path, and parent layout diagnostics.
