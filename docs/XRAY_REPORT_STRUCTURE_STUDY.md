# X-Ray Graduation Report Structure Study

Date studied: 2026-06-16

Reference file: `docs/Graduation_Project_xray 1 report.pdf`

This study records the useful structure and testing pattern from the X-ray team's graduation report so the AXIOM report can follow the same academic style without copying their project content.

## 1. Overall Structure

The X-ray report is a 104-page academic project report titled "Chest Pneumonia Detection Web Application". Its structure closely follows the faculty graduation-project format and is useful as a layout reference for AXIOM.

The front matter contains:

- Cover page with project title, student names, supervisor, faculty, and year.
- Committee Report.
- Intellectual Property Right Declaration.
- Anti-Plagiarism Declaration.
- Table of Contents.
- List of Figures.
- List of Tables.
- Abstract.
- List of abbreviations and acronyms.

The main chapters are:

| Chapter | Sections used in the X-ray report | Useful AXIOM adaptation |
| --- | --- | --- |
| Chapter 1: Introduction | Overview, Motivation, Objective, Aim, Scope, General Constraints | Keep the same chapter spine, but describe AXIOM as an AI-powered real estate platform for Egypt. |
| Chapter 2: Background and Previous Work | Background, Previous Work | Keep market background and competitor analysis. |
| Chapter 3: Planning and Analysis | Feasibility and cost, Gantt chart, analysis of existing systems, need for new system, user/system/domain/functional/non-functional requirements, advantages, user characteristics | Use AXIOM feasibility, requirements, users, admin workflows, AI, payments, fraud, and subscriptions. |
| Chapter 4: Design | Constraints, assumptions, risks, ERD, mapping, class diagram, use case diagram, scenarios, activity diagrams, sequence diagrams, state diagram | Use code-grounded AXIOM UML/Mermaid diagrams. |
| Chapter 5: Implementation | Software architecture, user interface, results and discussion | Use AXIOM stack, frontend routes, backend routers, Supabase schema, AI/RAG, Stripe, dashboard/admin UI. |
| Chapter 6: Testing | Unit testing and integration testing | Expand AXIOM testing with automated backend tests, frontend TypeScript verification, integration flows, and manual system test cases. |
| Closing | Conclusion, Future Work, References | Keep formal closing and source list. |

## 2. Figure and Table Pattern

The report uses many figures and tables as evidence, not decoration. The useful pattern is:

- Planning evidence: Gantt chart.
- Design evidence: ERD, relational mapping, class diagram, use case diagram, activity diagrams, sequence diagram, state diagram.
- Architecture evidence: model/software architecture diagrams.
- Implementation evidence: screenshots of major user interface screens.
- Results evidence: classification reports, confusion matrices, and training/validation charts.
- Testing evidence: screenshots of unit tests and API/manual tests.
- Manual verification evidence: test-case tables with expected result, actual result, and status.

AXIOM should follow the same evidence idea, but with AXIOM-specific evidence:

- Design diagrams already generated from Mermaid and PlantUML.
- Backend pytest inventory and test mapping.
- Frontend `npx tsc --noEmit` verification.
- Manual system test cases for signup, login, search, AI search, listing creation, admin approval, booking payment, WhatsApp lead capture, subscription checkout, and logout.
- Integration-flow table for frontend/backend/Supabase/Ollama/Stripe interactions.

## 3. What They Did for Testing

The X-ray report's Chapter 6 starts with a conceptual explanation of unit testing in web APIs. It explains that unit tests validate functions, services, methods, or classes independently from external systems such as databases, APIs, and cloud services.

Their unit-testing goals include:

- Logic validation for services and methods.
- Early bug detection during development.
- Code quality improvement.
- Isolation using mocks and stubs.
- Refactoring safety.

Their stated testing approach includes:

- Testing business logic independently of infrastructure and I/O.
- Mocking repositories, API clients, and external services.
- Handling edge cases such as null inputs, boundary values, and error conditions.
- Running tests through common frameworks such as xUnit, NUnit, pytest, and Jest.
- Using tests for fast feedback during active development.

The X-ray report then provides visual proof:

| Evidence | Description |
| --- | --- |
| Figure 32 | Doctor service tests in .NET API. |
| Figure 33 | Token service tests in .NET API. |
| Figure 34 | Authentication service tests in .NET API. |
| Figure 35 | FastAPI test for a viral pneumonia X-ray prediction. |
| Figure 36 | FastAPI test for a normal X-ray prediction. |
| Figure 37 | Another normal X-ray prediction test. |
| Figure 38 | FastAPI test for a lung-opacity X-ray prediction. |

They also describe manual testing in three layers:

| Layer | What they tested |
| --- | --- |
| Application | Each app screen and navigation between screens to ensure UI screens work without errors. |
| Server communication | Application-to-server and server-to-application communication, including image upload, returned information, and transmission speed. |
| Model | The chest X-ray model behavior and overfitting risk through model evaluation results. |

Finally, they include manual test-case tables. The tables use columns for:

- Test Case ID.
- Test Scenario.
- Test Case.
- Test Steps.
- Expected Results.
- Actual Results.
- Status.

The visible manual cases include:

| Test case | Scenario |
| --- | --- |
| Sign-up | Enter valid user information and confirm successful signup/navigation. |
| Login | Enter valid credentials and confirm successful login. |
| Image diagnosis | Upload a valid image and confirm a diagnosis/result is returned. |
| Logout | Click logout and confirm return to login/main screen. |

## 4. AXIOM Testing Pattern to Add

AXIOM should not copy the X-ray domain tests. Instead, it should copy the testing shape:

1. Start Chapter 6 with a short explanation of unit testing in AXIOM's web/API context.
2. Add a table mapping real backend pytest files to test focus.
3. Add a second table mapping important AXIOM modules to what is verified.
4. Add an integration-testing section that follows real data flows across Next.js, FastAPI, Supabase, Ollama, and Stripe.
5. Add a manual system test-case table in the same style as the X-ray report.
6. Keep frontend verification as a TypeScript compile gate because that is the current documented frontend automated gate.
7. Be honest that a complete Playwright/Cypress browser suite is future work unless it is added later.

## 5. Recommended AXIOM Manual Test Cases

| Test Case ID | Test Scenario | Test Case | Expected Result |
| --- | --- | --- | --- |
| TC_SIGNUP_001 | User registration | Sign up with valid name, email, password, and phone data | User account is created and profile is available. |
| TC_LOGIN_002 | User authentication | Log in with valid credentials | User enters authenticated session and dashboard is reachable. |
| TC_SEARCH_003 | Listing discovery | Apply listing filters on the find-homes page | Matching active listings are displayed. |
| TC_AI_SEARCH_004 | Natural-language search | Search with a natural language housing request | AI/search endpoint returns relevant structured results. |
| TC_CREATE_LISTING_005 | Listing submission | Create a rent, sale, or shared-housing listing | Listing is stored with pending status. |
| TC_ADMIN_APPROVE_006 | Admin moderation | Admin approves a pending listing | Listing status changes to active. |
| TC_BOOKING_007 | Booking payment | Book a rent/shared-housing listing through Stripe test mode | PaymentIntent/booking records are created and synchronized. |
| TC_LEAD_008 | WhatsApp lead capture | Click WhatsApp contact on a listing | Lead record is created and the user can continue to WhatsApp. |
| TC_SUBSCRIPTION_009 | Owner subscription | Start trial or checkout for Basic/Pro plan | Subscription/trial state is created and limits can be checked. |
| TC_LOGOUT_010 | Session exit | Log out from the application | User session is cleared and protected pages require login again. |

## 6. Report Update Decision

The AXIOM report should keep the original faculty-style chapter structure, but Chapter 6 should be expanded to match the X-ray report's seriousness. The updated AXIOM Chapter 6 should include:

- Unit testing explanation.
- Real automated backend test coverage table.
- Unit-test evidence mapped to AXIOM subsystems.
- Integration testing flow table.
- Manual system test cases.
- Frontend TypeScript verification.
- Testing limitations and future enhancements.

