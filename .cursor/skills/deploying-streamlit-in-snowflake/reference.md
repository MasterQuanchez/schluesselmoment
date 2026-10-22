# Streamlit in Snowflake — Admin Reference

Source: Snowflake administrators' internal documentation for SiS development and GitLab CI/CD deployment.

## Promotion path (GitLab → Snowflake)

Work only in the **Snowflake project GitLab repo**, starting on **`DEV`**.

1. Prepare/verify SiS files on `DEV` (ask before edits).
2. Start Streamlit locally (`streamlit run streamlit_src/streamlit_main.py`) and confirm startup has no errors.
3. Commit and push `DEV`.
4. Merge request **DEV → UAT** and merge (commit title must match DEV→UAT regex) → `Deploy_UAT_Streamlit*` pipeline deploys to UAT.
5. User verifies the app in Snowflake UAT.
6. Merge request **UAT → master** and merge (commit title must match UAT→master regex) → `Deploy_PRD_Streamlit*` deploys to PRD.

Do not promote to master until UAT is confirmed working.

## Overview

Streamlit is an open-source Python library which one can use to quickly build and deploy powerful data applications. It gives data teams and practitioners a quick way to build their data driven applications.

"Streamlit in Snowflake" helps developers securely build, deploy, and share Streamlit apps on Snowflake.

Using Streamlit in Snowflake, you can build applications that process and use data in Snowflake without moving data or application code to an external system.

It is important to note that there are two versions of Streamlit. Streamlit exists as a Python library (see https://streamlit.io/) and that there is a built-in version inside Snowflake for easily hosting Streamlit applications inside of Snowflake (SiS) (see About Streamlit in Snowflake (SiS)).

## Need to Know About Streamlit in Snowflake (SiS)

- Streamlit apps are Snowflake schema level objects and use Role-based Access Control (RBAC) to manage access to Streamlit apps.
- Streamlit applications will run with owner's rights (see Streamlit owner's rights), i.e. the role that is used to create the Streamlit application is used at runtime when using the Streamlit application.
- In order for end-users to use the Streamlit in Snowflake application they need USAGE privilege on the database, schema and the Streamlit object itself.
- A SiS app runs on a Snowflake warehouse and uses an internal stage to store files.
- To run a Streamlit app, you must select a single virtual warehouse to run both the app itself and its queries. This warehouse remains active while the app’s WebSocket connection is active. The WebSocket connection, which keeps the Streamlit app’s virtual warehouse active, expires approximately 15 minutes after the app’s last use.
- As Streamlit in Snowflake and Streamlit Open Source are not running on the same version and due to the fact that with Streamlit in Snowflake you are running your application in a hosted and goverend environment there are some limitations that one should be aware of — see SiS limitations and unsupported features; also AWS PrivateLink and SiS.

## Developing a Streamlit in Snowflake (SiS) Application

SiS offers single page applications and multi-page applications.

| Single-page | Multi-page |
|-------------|------------|
| Easier to start with but does not scale that well (more suited for small applications) | Better suited for mid to large sized applications |
| Can be created and developed using the Snowsight user interface (via the menu in Snowflake). | Can only be created and developed using SQL and python commands. |
| Can be implemented in Snowflake using the side-by-side editor (code next to application) | No support for development inside of Snowflake. Needs to be developed locally and then deployed via the CI/CD pipeline. |
| All the python code needed is put inside a single .py file | Python code is split across multiple smaller sub-pages in a "pages" folder |

A good starting point for first steps: Snowflake docs — Build your first SiS app.

## Deploying via the GitLab CI/CD Pipeline

### 1.) Structuring your Code

In order to deploy your Streamlit in Snowflake application to UAT or PRD the necessary files need to be placed in a "streamlit_src" folder in the root directory of your Gitlab project repository.

If your Streamlit in Snowflake application is a multi-page application (multiple Streamlit pages), please put the sub-pages into a "pages" folder.

| Name | Type | Optional | Description |
|------|------|----------|-------------|
| streamlit_src | folder | no | containing all Streamlit in Snowflake relevant logic |
| pages | folder | yes | folder inside streamlit_src that includes the subpages |
| streamlit_main.py | file | no | the main entrypoint for for your Streamit in Snowflake app |
| environment.yml | file | yes | the packages required for your specific Streamlit in Snowflake application and/or specific Streamlit version that you want to use |
| utils | file or folder | yes | utility scripts that are required within your app. i.e. utils.py, .sql scripts etc.) |

### 2.) Adding and Modifying streamlit_setup.py

If not already included in your Gitlab repository make sure to include the "streamlit_setup.py" file in the following path: `CICD_Setup/streamlit_setup.py`

The official Snowflake-administrators template shipped with this skill is [templates/streamlit_setup.py](templates/streamlit_setup.py). Copy it to `CICD_Setup/streamlit_setup.py`, then adjust the TODO parameter block.

**CI CLI compatibility:** If your `.gitlab-ci.yml` uses the preferred `.sis.gitlab-ci.yml` trigger (with `STREAMLIT_NAME`, `STREAMLIT_TITLE`, etc.), the deploy job calls `streamlit_setup.py` with `-name`, `-title`, `-entrypoint`, `-query_wh`, `-schema`, and `-stage`. The template includes matching optional `argparse` arguments; older copies without them fail with `unrecognized arguments`. Always use the current skill template or add those six flags before first deploy.

In this streamlit_setup.py script you will need to adjust some variables for your individual application. The skill agent must **ask the user for each `param_*` value**, recommend defaults when unsure, and use the **GitLab repository name as default `project_name`**.

| Variable | Description |
|----------|-------------|
| param_streamlit_name | Name of the Streamlit in Snowflake object - not visible to end users |
| param_streamlit_title | Title of your Streamlit in Snowflake application - that is visible to the users |
| param_streamlit_entrypoint | The name of your "home" file. |
| param_streamlit_query_warehouse | The warehouse that is used to execute the Streamlit in Snowflake application. This could be a default warehouse such as deployment_xs, or it could be a dedicated warehouse only for Streamlit in Snowflake applications. |
| param_snowflake_schema | The schema that should be used for the stage and Streamlit in Snowflake object itself. |
| param_snowflake_stage | The name of the stage that holds the all the files for the Streamlit application. The streamlit_setup.py file will be used to upload all the files in the streamlit_src folder from your Gitlab repo to this Snowflake internal stage. |

You can create a stage on your own before deploying the Streamlit application and simply reference this stage. In case the stage does not exist yet, the streamlit_setup.py file will create a new stage with the specified name.

### 3.) Adding environment.yml (Optional)

Although technically optional, you should include an environment.yml file to specify dependencies for you application and to point to a specific Streamlit version.

See https://docs.snowflake.com/en/developer-guide/streamlit/create-streamlit-sql

Example (place in `streamlit_src`):

```yaml
name: sf_env
channels:
- snowflake
dependencies:
- scikit-learn
- streamlit=1.31.1
```

### 4.) Adjusting .gitlab-ci.yml

This step may be not needed for new projects, but for old projects. Just search for Deploy_UAT_Streamlit and Deploy_PRD_Streamlit in your .gitlab-ci.yml. If these are already there you are good and can skip this step. If they are missing please add them.

One time setup for each project that wants to deploy Streamlit in Snowflake applications via the CICD pipeline: In your root repository of your Gitlab project open the .gitlab-ci.yml file and add the following code blocks at the end of the file.

#### For DEV to UAT (legacy admin snippet)

```yaml
Deploy_UAT_Streamlit:
  stage: deploy
  variables:
    PROJECT_ID: $CI_PROJECT_ID
    PROJECT_NAME: $CI_PROJECT_NAME
  trigger:
    include:
      - project: 'snowflake-se-da/sf-projects/CI_template'
        ref: 'master'
        file: '.gitlab-ci.yml'
    strategy: depend    
  rules:
  - if: $CI_COMMIT_BRANCH == "UAT"   && $CI_COMMIT_TITLE =~ /^[A-Za-z][A-Za-z]+ [A-Za-z]+ 'DEV'? [A-Za-z]+ 'UAT'?$/
    changes:
    - "streamlit_src/**/*"
```

#### For UAT to PRD (legacy admin snippet)

```yaml
Deploy_PRD_Streamlit:
  stage: deploy
  variables:
    PROJECT_ID: $CI_PROJECT_ID
    PROJECT_NAME: $CI_PROJECT_NAME
  trigger:
    include:
      - project: 'snowflake-se-da/sf-projects/CI_template'
        ref: 'master'
        file: '.gitlab-ci.yml'
    strategy: depend    
  rules:
  - if: $CI_COMMIT_BRANCH == "master"   && $CI_COMMIT_TITLE =~ /^[A-Za-z][A-Za-z]+ [A-Za-z]+ 'UAT'? [A-Za-z]+ 'master'?$/
    changes:
    - "streamlit_src/**/*"
```

#### Current preferred pattern (observed in project templates)

Newer project templates use `.sis.gitlab-ci.yml` and pass Streamlit settings as CI variables (job names may end with `_P`):

```yaml
Deploy_UAT_Streamlit_P:
  stage: deploy_pre_scripts
  variables:
    PROJECT_ID: $CI_PROJECT_ID
    PROJECT_NAME: $CI_PROJECT_NAME
    SIS_APP_FOLDER: ''
    STREAMLIT_NAME: 'YOUR_APP_NAME'
    STREAMLIT_TITLE: 'Your App Title'
    STREAMLIT_ENTRYPOINT: 'streamlit_main.py'
    STREAMLIT_QUERY_WAREHOUSE: 'WH_UAT_${CI_PROJECT_NAME}_DEPLOYMENT_XS'
    SNOWFLAKE_SCHEMA: 'PS_AC_${CI_PROJECT_NAME}'
    SNOWFLAKE_STAGE: 'STG_${CI_PROJECT_NAME}_STREAMLIT'
  trigger:
    include:
      - project: 'snowflake-se-da/sf-projects/CI_template'
        ref: 'master'
        file: '.sis.gitlab-ci.yml'
    strategy: depend
  rules:
    - if: $CI_COMMIT_BRANCH == "UAT" && $CI_COMMIT_TITLE =~ /^[A-Za-z][A-Za-z]+ [A-Za-z]+ 'DEV'? [A-Za-z]+ 'UAT'?$/
      changes:
        - "streamlit_src/**/*"
```

Mirror for PRD with branch `master`, warehouse `WH_PRD_...`, and the UAT→master commit-title regex. Keep `streamlit_setup.py` defaults aligned with these CI variables.

**Pipeline `changes:` rule:** SiS deploy jobs only run when `streamlit_src/**/*` changes. After fixing `streamlit_setup.py` alone, touch a file under `streamlit_src/` in the same MR so the job triggers.

**Typical CI invocation** (from `.sis.gitlab-ci.yml`):

```bash
python $CI_PROJECT_DIR/CICD_Setup/streamlit_setup.py \
  -f streamlit_src/$SIS_APP_FOLDER \
  -a $SNOWFLAKE_ACCOUNT_UAT -u $SNOWFLAKE_USER_UAT -r $SNOWFLAKE_ROLE_UAT -w $SNOWFLAKE_WAREHOUSE_UAT \
  -p $PROJECT_NAME -e $CI_ENVIRONMENT_NAME -id $PROJECT_ID \
  -name $STREAMLIT_NAME -title $STREAMLIT_TITLE \
  -query_wh $STREAMLIT_QUERY_WAREHOUSE -schema $SNOWFLAKE_SCHEMA -stage $SNOWFLAKE_STAGE
```

`streamlit_setup.py` must accept all flags shown after `-id`.

## Miscellaneous

### Deploying Multiple Streamlit in Snowflake Applications via the CI/CD pipeline

Q: I want to deploy multiple Streamlit in Snowflake applications. How can I achieve that?

A: For now, although this is not an ideal setup, you can simply deploy one application after the other and make sure to adjust the stage that should be used for the respective SiS application in the streamlit_setup.py file.

### Sharing Streamlit in Snowflake Applications

End users need USAGE on the database, schema, and Streamlit object. Apps run with owner's rights — grant carefully. Prefer role-based grants consistent with the project's Snowflake access model.

### UI Customization Possibilities (Company Brand Identity)

Follow company brand guidelines for colors, logo, and typography where SiS allows custom CSS/`st.markdown` injection. Respect SiS unsupported-feature limits (some custom components / browser APIs may not work).
