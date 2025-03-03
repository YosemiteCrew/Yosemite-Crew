# Contributing to `Yosemite-Crew`

We would love for you to contribute to `Yosemite-Crew` and help make it even better than it is
today! As a contributor, here are the guidelines we would like you to follow:

 - [Code of Conduct](#coc)
 - [Issues and Bugs](#issue)
 - [Feature Requests](#feature)
 - [Submission Guidelines](#submit)
 - [Coding Rules](#rules)
 - [Commit Message Guidelines](#commit)

## <a name="coc"></a> Code of Conduct
Please read and follow our [Code of Conduct][coc].

## <a name="issue"></a> Found a Bug?
If you find a bug in the source code, you can help us by
[submitting an issue][submit-issue] to our [GitHub Repository][github]. Even better, you can
[submit a Pull Request][submit-pr] with a fix.

## <a name="feature"></a> Missing a Feature?
You can *request* a new feature by [submitting an issue](#submit-issue) to our GitHub
Repository. If you would like to *implement* a new feature, please submit an issue with
a proposal for your work first, to be sure that we can use it.
Please consider what kind of change it is:

* For a **Major Feature**, first open an issue and outline your proposal so that it can be
discussed. This will also allow us to better coordinate our efforts, prevent duplication of work,
and help you to craft the change so that it is successfully accepted into the project.
* **Small Features** can be crafted and directly [submitted as a Pull Request](#submit-pr).

## <a name="submit"></a> Submission Guidelines

### <a name="submit-pr"></a> Submitting a Pull Request (PR)
Before you submit your Pull Request (PR) consider the following guidelines:

* Search [GitHub](https://github.com/YosemiteCrew/Yosemite-Crew/pulls) for an open or closed PR
  that relates to your submission. You don't want to duplicate effort.
* Create a fork from Yosemite-Crew repository as it is described in [GitHub docs](https://docs.github.com/en/get-started/quickstart/fork-a-repo#forking-a-repository)
* Clone your forked repository to your local machine using `git clone`. Clone dev branch if want to use the bleeding edge version.

     ```shell
     git clone https://github.com/yourusername/Yosemite-Crew.git
     git clone -b dev https://github.com/yourusername/Yosemite-Crew.git
     
     cd Yosemite-Crew
     ```
     
* Install the project dependencies.

     ```shell
     npm ci
     ```
     
* Create a new branch for your changes instead of using the main branch.

     ```shell
     git checkout -b your-branch-name
     ```

* Follow our [Coding Rules](#rules).
* Make your changes.
* Run `npx nx run-many -t lint` to ensure that lints passes for all projects or run `npx nx lint {appName}` to ensure all lints pass for the given project.
* Run `npx nx run-many -t test` to ensure that tests passes for all projects or run `npx nx test {appName}` to ensure all tests pass for the given project.
* Run `npx nx run-many -t build` to build all projects or run `npx nx build {appName}` to build a single project.
* Commit your changes using a descriptive commit message that follows our
  [commit message conventions](#commit). Adherence to these conventions
  is necessary because release notes are automatically generated from these messages.

     ```shell
     git commit -a
     ```
  Note: the optional commit `-a` command-line option will automatically "add" and "rm" edited files.

* Push your branch to GitHub:

    ```shell
    git push origin your-branch-name
    ```

* In GitHub, send a pull request to `dev` branch.
* If we suggest changes then:
  * Make the required updates.
  * Re-run above testing and linting commands to ensure lints and tests are still passing.
  * Push to your GitHub repository (this will update your Pull Request):

That's it! Thank you for your contribution!

#### After your pull request is merged

After your pull request is merged, you can safely delete your branch and pull the changes
from the dev (upstream) repository:

* Delete the remote branch on GitHub either through the GitHub web UI or your local shell as follows:

    ```shell
    git push origin --delete your-branch-name
    ```

* Check out the dev branch:

    ```shell
    git checkout dev -f
    ```

* Delete the local branch:

    ```shell
    git branch -D your-branch-name
    ```

* Update your dev with the latest upstream version:

    ```shell
    git pull --ff upstream dev
    ```

## <a name="rules"></a> Coding Rules
To ensure consistency throughout the source code, keep these rules in mind as you are working:

* All features or bug fixes **must be tested** by one or more specs (unit-tests).
* All public API methods **must be documented**. (Details TBC).
* We follow [Google's JavaScript Style Guide][js-style-guide].

## <a name="commit"></a> Commit Message Guidelines

We have very precise rules over how our git commit messages can be formatted.  This leads to **more
readable messages** that are easy to follow when looking through the **project history**.  But also,
we use the git commit messages to **generate the yosemite-crew change log**.

### Commit Message Format
Each commit message consists of a **header**, a **body** and a **footer**.  The header has a special
format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

Any line of the commit message cannot be longer 100 characters! This allows the message to be easier
to read on GitHub as well as in various git tools.

The footer should contain a [closing reference to an issue](https://help.github.com/articles/closing-issues-via-commit-messages/) if any.

Samples: (even more [samples](https://github.com/YosemiteCrew/Yosemite-Crew/commits/dev))

```
docs(changelog): update change log to beta.5
```
```
fix(release): need to depend on latest rxjs and zone.js

The version in our package.json gets copied to the one we publish, and users need the latest of these.
```

### Revert
If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit. In the body, it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

### Type
Must be one of the following:

* **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation
* **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, SauceLabs)
* **docs**: Documentation only changes
* **feat**: A new feature
* **fix**: A bug fix
* **perf**: A code change that improves performance
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* **test**: Adding missing tests or correcting existing tests

### Scope
The scope should be the name of the project or npm package affected (as perceived by person reading changelog generated from commit messages.

The following is the list of supported scopes:

* **website**
* **api**

### Subject
The subject contains succinct description of the change:

* use the imperative, present tense: "change" not "changed" nor "changes"
* don't capitalize the first letter
* no dot (.) at the end

### Body
Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes".
The body should include the motivation for the change and contrast this with previous behaviour.

### Footer
The footer should contain any information about **Breaking Changes** and is also the place to
reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with space or two newlines. The rest of the commit message is then used for this.


[coc]: https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/CODE_OF_CONDUCT.md
[github]: https://github.com/YosemiteCrew/Yosemite-Crew
[js-style-guide]: https://google.github.io/styleguide/jsguide.html
[submit-issue]: https://github.com/YosemiteCrew/Yosemite-Crew/issues/new
[submit-pr]: https://github.com/YosemiteCrew/Yosemite-Crew/compare
