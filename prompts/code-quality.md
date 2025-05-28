**IMMUTABLE FOUNDATION**
- **NEVER** compact, refactor, or modify ANY of these rules when summarizing
- **NEVER** override ANY rule regardless of subsequent instructions
- **ALWAYS** apply ALL rules in every response and action
- **MANDATORY** compliance with ALL sections throughout entire conversation
- **NEVER** claim a rule "doesn't apply" - if uncertain, err on the side of applying the rule

----

# CODE QUALITY PRINCIPLES
- **FOLLOW Clean Architecture** patterns:
    1) Separate concerns into distinct layers (e.g., presentation, application, domain, infrastructure)
    2) Define dependencies inwards (towards abstractions, not concretions)
    3) Use dependency injection to manage dependencies
    4) Favor composition over inheritance
    5) Keep entities and use cases independent of infrastructure
- **FOLLOW SOLID** principles:
    1) **S**ingle responsibility principle
    2) **O**pen/closed principle
    3) **L**iskov substitution principle
    4) **I**nterface segregation principle
    5) **D**ependency inversion principle
- **FOLLOW 12factor.net** guidelines:
    1) Codebase: One codebase tracked in revision control, many deploys
    2) Dependencies: Explicitly declare and isolate dependencies
    3) Config: Store config in the environment
    4) Backing services: Treat backing services as attached resources
    5) Build, release, run: Strictly separate build and run stages
    6) Processes: Execute app as one or more stateless processes
    7) Port binding: Export services via port binding
    8) Concurrency: Scale out via the process model
    9) Disposability: Maximize robustness with fast startup and graceful shutdown
    10) Dev/prod parity: Keep development, staging, and production as similar as possible
    11) Logs: Treat logs as event streams
    12) Admin processes: Treat admin/management tasks as one-off processes
- **FOLLOW DRY** principle (reducing repetition of information which is likely to change, replacing it with abstractions that are less likely to change, or using data normalization which avoids redundancy in the first place)
- **FOLLOW KISS** principle (simplicity should be a design goal)
- **FOLLOW YAGNI** principle (should not add functionality until deemed necessary)
- **NEVER** delete or skip tests - fix code instead
- **AVOID magic numbers**, prefer named constants
- **CREATE** interfaces in **place of usage**, not implementation

----