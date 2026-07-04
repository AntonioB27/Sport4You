# Login by Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Account recovery via the assignment-guaranteed-unique name: `POST /api/users/login` + a login mode in the register dialog.

**Architecture:** Additive only — repository gains a name lookup, service exposes `FindByNameAsync`, controller adds a `login` action; the dialog becomes two-mode. The mandated `POST /api/users` register contract is untouched.

**Tech Stack:** ASP.NET Core, EF Core/SQLite, xunit; Angular 17 standalone + Material dialog.

**Spec:** `docs/superpowers/specs/2026-07-05-login-by-name-design.md`

## Global Constraints

- **NEVER commit.** Antonio handles all git commits himself. No `git add`/`git commit` steps anywhere.
- Do not modify the register endpoint, its DTO validation, or its 409 behavior.
- Name matching must reuse the same `==` comparison the register uniqueness check uses (`UserRepository.ExistsByNameAsync`) — do not add case-insensitivity.
- Backend check: `cd /Users/antoniobecic/repo/neogov/sport4you/backend && dotnet test`. Frontend check: `cd /Users/antoniobecic/repo/neogov/sport4you/frontend && npx ng build 2>&1 | tail -5` (bundle-budget warnings are pre-existing).

---

### Task 1: Backend login endpoint (TDD)

**Files:**
- Modify: `backend/Sport4You.Api/Repositories/IUserRepository.cs`
- Modify: `backend/Sport4You.Api/Repositories/UserRepository.cs`
- Modify: `backend/Sport4You.Api/Services/IUserService.cs`
- Modify: `backend/Sport4You.Api/Services/UserService.cs`
- Modify: `backend/Sport4You.Api/Controllers/UsersController.cs`
- Test: `backend/Sport4You.Tests/UsersControllerTests.cs`

**Interfaces:**
- Produces: `POST /api/users/login` accepting `RegisterUserRequest` JSON → `200 { userId, firstName, lastName }` | `404 { error }` | `400` on missing fields. Task 2's frontend calls it.
- Produces: `IUserService.FindByNameAsync(string firstName, string lastName): Task<User?>`.

- [ ] **Step 1: Write the failing tests**

Append to the test class in `backend/Sport4You.Tests/UsersControllerTests.cs` (match the file's existing helper style — it registers via `_client.PostAsJsonAsync("/api/users", …)`):

```csharp
    [Fact]
    public async Task Login_WithExistingName_ReturnsSameUserId()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        var reg = await _client.PostAsJsonAsync("/api/users", new { firstName = "Login", lastName = suffix });
        var regBody = await reg.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        var r = await _client.PostAsJsonAsync("/api/users/login", new { firstName = "Login", lastName = suffix });
        Assert.Equal(System.Net.HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(regBody!["userId"], body.GetProperty("userId").GetString());
        Assert.Equal("Login", body.GetProperty("firstName").GetString());
    }

    [Fact]
    public async Task Login_WithUnknownName_Returns404()
    {
        var r = await _client.PostAsJsonAsync("/api/users/login",
            new { firstName = "Ghost", lastName = Guid.NewGuid().ToString("N")[..6] });
        Assert.Equal(System.Net.HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task Login_MatchesWithRegisterComparisonSemantics()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6];
        await _client.PostAsJsonAsync("/api/users", new { firstName = "Casey", lastName = suffix });

        // register comparison is case-sensitive (SQLite ==) — login must mirror it
        var r = await _client.PostAsJsonAsync("/api/users/login", new { firstName = "casey", lastName = suffix });
        Assert.Equal(System.Net.HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task Login_WithMissingFields_Returns400()
    {
        var r = await _client.PostAsJsonAsync("/api/users/login", new { firstName = "OnlyFirst" });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, r.StatusCode);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/antoniobecic/repo/neogov/sport4you/backend && dotnet test --filter "Login" 2>&1 | tail -5`
Expected: 4 failures (404 from missing route on the first three — the 400 test may pass already only if routing 404s; treat any non-green as the expected failing state).

- [ ] **Step 3: Implement**

`IUserRepository.cs` — add to the interface:

```csharp
    Task<User?> GetByNameAsync(string firstName, string lastName);
```

`UserRepository.cs` — add next to `ExistsByNameAsync`:

```csharp
    public Task<User?> GetByNameAsync(string firstName, string lastName)
        => _db.Users.FirstOrDefaultAsync(u => u.FirstName == firstName && u.LastName == lastName);
```

`IUserService.cs` — add to the interface:

```csharp
    Task<User?> FindByNameAsync(string firstName, string lastName);
```

`UserService.cs` — add method (and `using Sport4You.Api.Models;` is already present):

```csharp
    public Task<User?> FindByNameAsync(string firstName, string lastName)
        => _users.GetByNameAsync(firstName, lastName);
```

`UsersController.cs` — add action after `Register`:

```csharp
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] RegisterUserRequest request)
    {
        var user = await _users.FindByNameAsync(request.FirstName, request.LastName);
        if (user == null)
            return NotFound(new { error = "No user found with that name." });
        return Ok(new { userId = user.Id, firstName = user.FirstName, lastName = user.LastName });
    }
```

(`RegisterUserRequest` has `[Required]` on both fields, so model validation produces the 400.)

- [ ] **Step 4: Run the full backend suite**

Run: `cd /Users/antoniobecic/repo/neogov/sport4you/backend && dotnet test 2>&1 | tail -3`
Expected: all tests pass (90 existing + 4 new).

---

### Task 2: Frontend login mode in the register dialog

**Files:**
- Modify: `frontend/src/app/shared/services/api.service.ts`
- Modify: `frontend/src/app/shared/components/register-dialog/register-dialog.component.ts`

**Interfaces:**
- Consumes: `POST /api/users/login` from Task 1.
- Produces: `ApiService.loginUser(firstName, lastName): Observable<{ userId: string }>`.

- [ ] **Step 1: Add the API method**

In `api.service.ts`, after `registerUser`:

```ts
  loginUser(firstName: string, lastName: string): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${this.base}/users/login`, { firstName, lastName });
  }
```

- [ ] **Step 2: Two-mode dialog**

Replace `register-dialog.component.ts`'s template and class logic with the two-mode version (styles/imports unchanged):

```ts
  template: `
    <h2 mat-dialog-title>{{ mode === 'register' ? 'Welcome to Sport4You 🏃' : 'Welcome back 👋' }}</h2>
    <mat-dialog-content>
      <p style="color: #666; margin-bottom: 16px;">
        {{ mode === 'register'
          ? 'Enter your name to join the fitness challenge and start competing on the leaderboard.'
          : 'Enter the name you registered with to recover your account.' }}
      </p>
      <form [formGroup]="form" style="display: flex; flex-direction: column; gap: 8px;">
        <mat-form-field appearance="outline">
          <mat-label>First Name</mat-label>
          <input matInput formControlName="firstName" placeholder="e.g. Alice" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last Name</mat-label>
          <input matInput formControlName="lastName" placeholder="e.g. Smith" />
        </mat-form-field>
      </form>
      <a style="font-size: 13px; color: #2E6BE6; cursor: pointer;" (click)="toggleMode()">
        {{ mode === 'register' ? 'Already have an account? Log back in' : 'New here? Create an account' }}
      </a>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-raised-button
        color="primary"
        [disabled]="form.invalid || loading"
        (click)="submit()"
      >
        {{ loading ? 'One moment…' : (mode === 'register' ? 'Join the Challenge' : 'Welcome back') }}
      </button>
    </mat-dialog-actions>
  `,
```

Class body:

```ts
export class RegisterDialogComponent {
  form = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
  });
  loading = false;
  mode: 'register' | 'login' = 'register';

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<RegisterDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  toggleMode() {
    this.mode = this.mode === 'register' ? 'login' : 'register';
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const { firstName, lastName } = this.form.value;

    if (this.mode === 'register') {
      this.api.registerUser(firstName!, lastName!).subscribe({
        next: ({ userId }) => this.finish(userId),
        error: (err) => {
          this.loading = false;
          if (err.status === 409) {
            // rescue path: same name already registered — offer to log back in
            this.snackBar
              .open('That name is already registered.', "That's me — log in", { duration: 6000 })
              .onAction()
              .subscribe(() => { this.mode = 'login'; this.submit(); });
          } else {
            this.snackBar.open('Registration failed. Please try again.', 'OK', { duration: 4000 });
          }
        },
      });
    } else {
      this.api.loginUser(firstName!, lastName!).subscribe({
        next: ({ userId }) => this.finish(userId),
        error: (err) => {
          this.loading = false;
          const message = err.status === 404
            ? 'No user found with that name.'
            : 'Login failed. Please try again.';
          this.snackBar.open(message, 'OK', { duration: 4000 });
        },
      });
    }
  }

  private finish(userId: string) {
    localStorage.setItem('userId', userId);
    this.dialogRef.close(userId);
  }
}
```

Note the old `register()` method is replaced by `submit()`; check for external callers first (`grep -rn "\.register()" frontend/src` — the dialog is opened via MatDialog, so none are expected).

- [ ] **Step 3: Verify build**

Run: `cd /Users/antoniobecic/repo/neogov/sport4you/frontend && npx ng build 2>&1 | tail -5`
Expected: `Application bundle generation complete`.

---

### Task 3: Runtime verification (Playwright)

**Files:**
- Create (scratch, not committed): `<scratchpad>/login-verify.mjs`

- [ ] **Step 1: Servers up**

`curl -s -o /dev/null -w "%{http_code}" http://localhost:5262/api/leaderboard` → 200; same for `http://localhost:4200`. Restart backend if it predates Task 1 (`dotnet run` picks up the new endpoint only after rebuild+restart).

- [ ] **Step 2: End-to-end recovery flow**

```js
// login-verify.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

const last = `T${Date.now() % 100000}`;

// 1. register through the dialog
await page.goto('http://localhost:4200/dashboard');
await page.waitForSelector('mat-dialog-container');
await page.fill('input[formcontrolname="firstName"]', 'Recover');
await page.fill('input[formcontrolname="lastName"]', last);
await page.click('text=Join the Challenge');
await page.waitForSelector('.hero-card', { timeout: 10000 });
const uid1 = await page.evaluate(() => localStorage.getItem('userId'));

// 2. simulate cleared cache
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:4200/dashboard');
await page.waitForSelector('mat-dialog-container');

// 3. recover via login mode
await page.click('text=Already have an account?');
await page.fill('input[formcontrolname="firstName"]', 'Recover');
await page.fill('input[formcontrolname="lastName"]', last);
await page.click('text=Welcome back');
await page.waitForSelector('.hero-card', { timeout: 10000 });
const uid2 = await page.evaluate(() => localStorage.getItem('userId'));
await page.screenshot({ path: 'login-recovered.png' });

// 4. duplicate-register rescue path
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:4200/dashboard');
await page.waitForSelector('mat-dialog-container');
await page.fill('input[formcontrolname="firstName"]', 'Recover');
await page.fill('input[formcontrolname="lastName"]', last);
await page.click('text=Join the Challenge');
await page.waitForSelector('text=That name is already registered.');
await page.click("text=That's me — log in");
await page.waitForSelector('.hero-card', { timeout: 10000 });
const uid3 = await page.evaluate(() => localStorage.getItem('userId'));

console.log('same account:', uid1 === uid2 && uid2 === uid3, '| errors:', errors.length ? errors : 'none');
await browser.close();
```

Run: `node login-verify.mjs`
Expected: `same account: true | errors: none`

- [ ] **Step 3: Inspect `login-recovered.png`** — dashboard shows the recovered account's data, and report results to Antonio (no commit).
