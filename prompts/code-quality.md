# CODE QUALITY STANDARDS

Follow these development principles:

## Architecture and Design
- **Clean Architecture**: Separate concerns into distinct layers (presentation, application, domain, infrastructure)
- **SOLID Principles**: Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion
- **12-Factor App**: Follow 12factor.net guidelines for modern application development
- **DRY Principle**: Don't repeat yourself - reduce repetition through abstractions
- **KISS Principle**: Keep it simple - simplicity should be a design goal
- **YAGNI Principle**: You aren't gonna need it - don't add functionality until necessary

## Code Standards
- **Never delete or skip tests** - fix code instead
- **Avoid magic numbers** - prefer named constants
- **Create interfaces** in place of usage, not implementation
- **Use dependency injection** to manage dependencies
- **Favor composition over inheritance**
- **Keep entities and use cases independent** of infrastructure