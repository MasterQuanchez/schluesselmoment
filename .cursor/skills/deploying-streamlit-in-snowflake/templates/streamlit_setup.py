import os
import argparse
import json
import snowflake.connector
import requests
import re
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from dataclasses import dataclass

parser = argparse.ArgumentParser(
    prog='streamlit', 
    description='Deploy Streamlit app to a Snowflake account.', 
    formatter_class=argparse.RawTextHelpFormatter
)
parser.add_argument('-f', '--root-folder', type=str, default="./streamlit_src", help='The root folder for the streamlit scripts', required=True)
parser.add_argument('-a', '--snowflake-account', type=str, help='The name of the snowflake account (e.g. xy12345.east-us-2.azure)', required=True)
parser.add_argument('-u', '--snowflake-user', type=str, help='The name of the snowflake user', required=True)
parser.add_argument('-r', '--snowflake-role', type=str, help='The name of the default role to use', required=True)
parser.add_argument('-w', '--snowflake-warehouse', type=str, help='The name of the default warehouse to use. Can be overridden in the change scripts.', required=True)
parser.add_argument('--vars', type=json.loads, help='Define values for the variables to replaced in change scripts, given in JSON format (e.g. {"variable1": "value1", "variable2": "value2"})', required=False)
parser.add_argument('-ac', '--autocommit', action='store_true', help='Enable autocommit feature for DML commands (the default is False)', required=False)
parser.add_argument('-v', '--verbose', action='store_true', help='Display verbose debugging details during execution (the default is False)', required=False)
parser.add_argument('-p', '--project-name', type=str, help='project name (the default is True)', required=True)
parser.add_argument('-e', '--environment_name', type=str, help='environment name (the default is True)', required=True)
parser.add_argument('-id', '--project_id', type=str, help='project id (the default is True)', required=True)
# Required when using .sis.gitlab-ci.yml — CI passes STREAMLIT_* / SNOWFLAKE_* as CLI overrides
parser.add_argument('-name', dest='streamlit_name', type=str, help='Streamlit object name override from CI', required=False)
parser.add_argument('-title', dest='streamlit_title', type=str, help='Streamlit title override from CI', required=False)
parser.add_argument('-entrypoint', dest='streamlit_entrypoint', type=str, help='Streamlit entrypoint override from CI', required=False)
parser.add_argument('-query_wh', dest='streamlit_query_warehouse', type=str, help='Query warehouse override from CI', required=False)
parser.add_argument('-schema', dest='snowflake_schema', type=str, help='Snowflake schema override from CI', required=False)
parser.add_argument('-stage', dest='snowflake_stage', type=str, help='Snowflake stage override from CI', required=False)

# Set args as global variable here
args = parser.parse_args()

#
# TODO: Adjust these parameters for your Streamlit in Snowflake application
# CI (.sis.gitlab-ci.yml) overrides via -name, -title, -entrypoint, -query_wh, -schema, -stage
#
param_streamlit_name = args.streamlit_name or f"STL_{args.project_name}_Streamlit".replace(" ", "_").upper()
param_streamlit_title = args.streamlit_title or f"{args.project_name} Streamlit"
param_streamlit_entrypoint = args.streamlit_entrypoint or "streamlit_main.py"
param_streamlit_query_warehouse = args.streamlit_query_warehouse or f"WH_{args.environment_name}_{args.project_name}_DEPLOYMENT_XS"
param_snowflake_schema = args.snowflake_schema or f"PS_AC_{args.project_name}"
param_snowflake_stage = args.snowflake_stage or f"STG_{args.project_name}_Streamlit".replace(" ", "_").upper()

@dataclass
class Config:
    streamlit_name: str
    streamlit_title: str
    streamlit_entrypoint: str
    streamlit_query_warehouse: str
    snowflake_database: str
    snowflake_schema: str
    snowflake_stage: str
    snowflake_stage_full_path: str


def load_config(args) -> Config:
    """Initializes and returns the configuration for the Streamlit in Snowflake application deployment based on provided cli arguments.

    Note:
        One can adjust the config variables here according to the project setup as needed.

    Args:
        args (argparse.Namespace): Parsed command-line arguments.

    Returns:
        Config: A configuration object with details for the Streamlit deployment.
    """

    streamlit_name=param_streamlit_name
    streamlit_title=param_streamlit_title
    streamlit_entrypoint=param_streamlit_entrypoint
    streamlit_query_warehouse=param_streamlit_query_warehouse
    snowflake_schema=param_snowflake_schema
    snowflake_stage=param_snowflake_stage

    # set snowflake_database and snowflake_stage_full_path depending on other config variables
    snowflake_database, snowflake_stage_full_path = get_db_and_stage_full_path(args, snowflake_schema, snowflake_stage)

    print("streamlit_name: "+ str(streamlit_name))
    print("streamlit_title: "+ str(streamlit_title))
    print("streamlit_entrypoint: "+ str(streamlit_entrypoint))
    print("streamlit_query_warehouse: "+ str(streamlit_query_warehouse))
    print("snowflake_database: "+ str(snowflake_database))
    print("snowflake_schema: "+ str(snowflake_schema))
    print("snowflake_stage: "+ str(snowflake_stage))
    print("snowflake_stage_full_path: "+ str(snowflake_stage_full_path))

    return Config(
        streamlit_name=streamlit_name,
        streamlit_title=streamlit_title,
        streamlit_entrypoint=streamlit_entrypoint,
        streamlit_query_warehouse=streamlit_query_warehouse,
        snowflake_database=snowflake_database,
        snowflake_schema=snowflake_schema,
        snowflake_stage=snowflake_stage,
        snowflake_stage_full_path=snowflake_stage_full_path
    )

def get_db_and_stage_full_path(args, snowflake_schema, snowflake_stage):
    """ Get database and snowflake_stage_full_path according depending on wether the project exists as database
    
    Args:
        args (argparse.Namespace): Parsed command-line arguments.
        snowflake_schema (str): Name of the Snowflake schema where the app will be created or updated.
        snowflake_stage (str):  Name of the stage where the app will be created or updated.

    Returns:    
        snowflake_database (str): Name of the Snowflake database where the app will be created or updated.
        snowflake_stage_full_path (str): Full path with database.schema.stage where the Streamlit app will be deployed   
    """

    try:
        # Establish a connection to the Snowflake `DB_OPERATIONS` database
        con = create_connection(snowflake_database = "DB_OPERATIONS", project_id = args.project_id, environment_name = args.environment_name)
        project_as_db = f"DB_{args.environment_name}_{args.project_name}"
        
        # Check if the project-specific database exists
        check_db_query = f"SHOW DATABASES LIKE '{project_as_db}'"
        result = con.cursor().execute(check_db_query).fetchall()
        
        # Update database and snowflake_stage_full_path depending on project is a project as db
        if result:
            snowflake_database = project_as_db
            snowflake_stage_full_path = f"{snowflake_database}.{snowflake_schema}.{snowflake_stage}"
            print(f"Project-specific database found: {snowflake_database}")
        else:
            snowflake_database = f"DB_{args.environment_name}_ACCESS"
            snowflake_stage_full_path = f"{snowflake_database}.{snowflake_schema}.{snowflake_stage}"
            print(f"No project-specific database found for {args.project_name}")
    except Exception as e:
        print(f"An unexpected error occurred during the project database check: {e}")
        raise e
    
    return snowflake_database, snowflake_stage_full_path

def set_environ_variables(snowflake_account, snowflake_user, snowflake_role, snowflake_warehouse) -> None:
    """
    Set os.environ variables according to arg parameters
    """
    os.environ["SNOWFLAKE_ACCOUNT"] = snowflake_account
    os.environ["SNOWFLAKE_USER"] = snowflake_user
    os.environ["SNOWFLAKE_ROLE"] = snowflake_role
    os.environ["SNOWFLAKE_WAREHOUSE"] = snowflake_warehouse
    os.environ["SNOWFLAKE_AUTHENTICATOR"] = 'snowflake'
    print("os.environ variables set")
    
def create_connection(snowflake_database, project_id, environment_name):
    """Establishes a Snowflake connection based on environment credentials.

    Args:
        snowflake_database (str): Name of the Snowflake database.
        project_id (str): The project ID.
        environment_name (str): The environment name (e.g., 'UAT', 'PRD').

    Returns:
        snowflake.connector.SnowflakeConnection: The Snowflake connection object.

    Raises:
        ValueError: If required environment variables or credentials are missing.
    """

    required_env_vars = ["ACCESS_TOKEN", "SNOWFLAKE_USER", "SNOWFLAKE_ACCOUNT", "SNOWFLAKE_ROLE", "SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_AUTHENTICATOR"]
    missing_vars = [var for var in required_env_vars if var not in os.environ]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    access_token = os.environ["ACCESS_TOKEN"]
    headers = {'PRIVATE-TOKEN': access_token}

    if environment_name == 'PRD':
        response = requests.get('https://code.siemens-energy.com/api/v4/projects/{0}/variables/PRIVATE_KEY_PASSPHRASE'.format(project_id), headers=headers)
    elif environment_name == 'UAT':
        response = requests.get('https://code.siemens-energy.com/api/v4/projects/{0}/variables/PRIVATE_KEY_PASSPHRASE_UAT'.format(project_id), headers=headers)
    else:
        raise ValueError("Environment name not supported for private key retrieval.")

    if response.status_code == 200:
        variable = response.json()
        private_key_passphrase = variable['value']
    else:
        raise ValueError("Failed to retrieve private key passphrase from the project repository.")

    if environment_name == 'UAT':
        with open(os.environ["PRIVATE_KEY_UAT"], "rb") as key:
            p_key = serialization.load_pem_private_key(key.read(), password=private_key_passphrase.encode(), backend=default_backend())
    elif environment_name == 'PRD':
        with open(os.environ["PRIVATE_KEY"], "rb") as key:
            p_key = serialization.load_pem_private_key(key.read(), password=private_key_passphrase.encode(), backend=default_backend())
    else:
        raise ValueError("Unable to find connection credentials for private key or password authentication")

    pkb = p_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )

    con = snowflake.connector.connect(
        user=os.environ["SNOWFLAKE_USER"],
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        role=os.environ["SNOWFLAKE_ROLE"],
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database=snowflake_database,
        authenticator=os.environ["SNOWFLAKE_AUTHENTICATOR"],
        private_key=pkb
    )

    return con


def replace_variables_in_file(file_path: str, environment_name: str, project_name: str) -> None:
    """Replaces placeholders with actual values in the specified file for the Streamlit application.

    Args:
        file_path (str): The path to the file to modify.
        environment_name (str): The environment name (e.g., 'UAT', 'PRD').
        project_name (str): The project name to use in replacements.

    Returns:
        None
    """

    print(f"replace_variables_in_file for: {file_path}")

    try:
      # Step 1: Read the content of the file
      with open(file_path, 'r') as file:
        content = file.read().strip() # Note: case_sensitive replacement. Variables need to be UPPERCASE

      # Define replacements based on the environment
      replacements = {
        'UAT': {
          "$DB_ACCESS": "DB_UAT_ACCESS",
          "$DB_ANALYTICS": "DB_UAT_ANALYTICS",
          "$DB_LANDING": "DB_UAT_LANDING",
          "$DB_PROJECT": f"DB_UAT_{project_name}",
          "$WH_JOBUSER_XS": f"WH_UAT_{project_name}_JOBUSER_XS",
          "$WH_JOBUSER_S": f"WH_UAT_{project_name}_JOBUSER_S",
          "$WH_JOBUSER_M": f"WH_UAT_{project_name}_JOBUSER_M"
        },
        'PRD': {
          "$DB_ACCESS": "DB_PRD_ACCESS",
          "$DB_ANALYTICS": "DB_PRD_ANALYTICS",
          "$DB_LANDING": "DB_PRD_LANDING",
          "$DB_PROJECT": f"DB_PRD_{project_name}",
          "$WH_JOBUSER_XS": f"WH_PRD_{project_name}_JOBUSER_XS",
          "$WH_JOBUSER_S": f"WH_PRD_{project_name}_JOBUSER_S",
          "$WH_JOBUSER_M": f"WH_PRD_{project_name}_JOBUSER_M"
        }
      }
        
      if environment_name not in replacements:
        raise ValueError(f"Cannot replace variables. Invalid environment_name {environment_name} detected")
        
      # Step 2: Replace the target strings with the replacement strings
      for key, value in replacements[environment_name].items():
        # Replace all occurrences of key with value (case-insensitive)
        content = re.sub(re.escape(key), lambda _: value, content, flags=re.IGNORECASE)
      
      # Step 3: Write the modified content back to the file
      with open(file_path, 'w') as file:
        file.write(content)
    
    except FileNotFoundError as e:
      print(f"The file {file_path} does not exist.")
      raise e
    except PermissionError as e:
      print(f"Permission denied when accessing {file_path}.")
      raise e
    except Exception as e:
      print(f"An unexpected error occurred: {e}")


def create_streamlit_stage_if_not_exists(con, snowflake_stage_full_path) -> bool:
    """Creates a Snowflake stage for deploying Streamlit files if the stage does not exist yet.

    Args:
        con (snowflake.connector.SnowflakeConnection): An active Snowflake connection object.
        snowflake_stage_full_path (str): Fully qualified name of the target stage to create.

    Returns:
        bool: True if the stage was created successfully, False otherwise.
    """

    if not con:
        raise ValueError("Snowflake connection (`con`) is required to create stage.")
    if not snowflake_stage_full_path:
        raise ValueError("Target stage (`snowflake_stage_full_path`) is required.")

    try:
        print(f'Creating Stage in Snowflake if not exists {snowflake_stage_full_path}')
        con.cursor().execute(f"CREATE STAGE IF NOT EXISTS {snowflake_stage_full_path};")
        print(f'Finished creating Stage in Snowflake {snowflake_stage_full_path}')
        return True
    except Exception as e:
        print(f"Error creating stage: {e}")
        raise e

def publish_sis_files(con, environment_name, project_name, sis_src_folder, snowflake_stage_full_path) -> bool:
    """Uploads all Streamlit-related source files to the specified Snowflake stage.

    Args:
        con (snowflake.connector.SnowflakeConnection): An active Snowflake connection object.
        environment_name (str): The name of the environment (e.g., 'UAT', 'PRD').
        project_name (str): The name of the project.
        sis_src_folder (str): Path to the Streamlit source folder.
        snowflake_stage_full_path (str): Fully qualified name of the Snowflake stage for Streamlit files.

    Returns:
        bool: True if files were uploaded successfully, False otherwise.

    Raises:
        ValueError: If any of the parameters `con`, `sis_src_folder`, or `snowflake_stage_full_path` are missing or invalid.
        FileNotFoundError: If the source folder does not exist.
        Exception: For other unexpected errors during file upload.
    """

    if not con:
        raise ValueError("Snowflake connection (`con`) is required to publish files.")
    if not sis_src_folder:
        raise ValueError("Source folder (`sis_src_folder`) is required.")
    if not os.path.isdir(sis_src_folder):
        raise FileNotFoundError(f"The source folder {sis_src_folder} does not exist.")
    if not snowflake_stage_full_path:
        raise ValueError("Target stage (`snowflake_stage_full_path`) is required.")

    try:
        print(f"Removing existing files from remote Snowflake Streamlit Stage: {snowflake_stage_full_path}.")
        con.cursor().execute(f"REMOVE @{snowflake_stage_full_path}")
        partition_by = sis_src_folder.split("/")[-1]

        print(f"Start uploading local Streamlit src to remote Snowflake Streamlit Stage: {snowflake_stage_full_path}.")
        for root, dirs, files in os.walk(sis_src_folder):
            stage_location = root.partition(partition_by)[2]
            for file in files:
                local_file_path = os.path.join(root, file)
                replace_variables_in_file(file_path=local_file_path, environment_name=environment_name, project_name=project_name)
                upload_files_cmd = f"PUT file://{local_file_path} @{snowflake_stage_full_path}{stage_location} OVERWRITE = TRUE AUTO_COMPRESS = FALSE;"
                print(upload_files_cmd)
                con.cursor().execute(upload_files_cmd)

        print(f"Successfully uploaded all Streamlit relevant files from {sis_src_folder} to Snowflake Streamlit Stage @{snowflake_stage_full_path}.")
        return True
    except Exception as e:
        print(f"Error uploading files to Snowflake stage: {e}")
        raise e

def create_streamlit_app(con, snowflake_database, snowflake_schema, streamlit_title, streamlit_name, snowflake_stage_full_path, streamlit_entrypoint, streamlit_query_warehouse):
    """Creates or updates a Streamlit app in Snowflake using the provided configuration.

    Args:
        con (snowflake.connector.SnowflakeConnection): An active Snowflake connection object.
        snowflake_database (str): Name of the Snowflake database where the app will be created or updated.
        snowflake_schema (str): Name of the Snowflake schema where the app will be created or updated.
        streamlit_title (str): Title of the Streamlit app.
        streamlit_name (str): Name of the Streamlit app object in Snowflake.
        snowflake_stage_full_path (str): Snowflake stage where the Streamlit app files are stored.
        streamlit_entrypoint (str): Main entrypoint file for the Streamlit app.
        streamlit_query_warehouse (str): Warehouse used for executing queries in the app.

    Raises:
        ValueError: If any required argument is missing.
        Exception: For unexpected errors during app creation or update.
    """
    
    try:
        con.cursor().execute(f"USE {snowflake_database}.{snowflake_schema};")
        sql_check_existing_app = f"SHOW STREAMLITS LIKE '{streamlit_name}' IN SCHEMA {snowflake_database}.{snowflake_schema};"
        print(sql_check_existing_app)
        existing_app = con.cursor().execute(sql_check_existing_app).fetchone()

        if existing_app:
            print(f"Updating existing Streamlit app: {streamlit_name}")
            con.cursor().execute(f"ALTER STREAMLIT {streamlit_name} SET ROOT_LOCATION = '@{snowflake_stage_full_path}' MAIN_FILE = '{streamlit_entrypoint}' QUERY_WAREHOUSE = '{streamlit_query_warehouse}' TITLE = '{streamlit_title}';")
        else:
            print(f"Creating new Streamlit app: {streamlit_name}")
            con.cursor().execute(f"CREATE STREAMLIT {streamlit_name} ROOT_LOCATION = '@{snowflake_stage_full_path}' MAIN_FILE = '{streamlit_entrypoint}' QUERY_WAREHOUSE = '{streamlit_query_warehouse}' TITLE = '{streamlit_title}';")

        print(f'Successfully deployed Streamlit app {streamlit_name} in Snowflake.')
    except Exception as e:
        print(f"Error creating or updating Streamlit app: {e}")
        raise e
    
def streamlit_deploy(root_folder, snowflake_account, snowflake_role, snowflake_warehouse, snowflake_database, project_name, environment_name, project_id, snowflake_schema, snowflake_stage_full_path, streamlit_name, streamlit_entrypoint, streamlit_title, streamlit_query_warehouse):
    """Deploys a Streamlit application to Snowflake.

    This function orchestrates the deployment of a Streamlit app by creating necessary stages,
    publishing source files, and creating or updating the Streamlit app in Snowflake.

    Args:
        root_folder (str): The root folder containing Streamlit scripts.
        snowflake_account (str): Snowflake account identifier.
        snowflake_role (str): Default role for Snowflake session.
        snowflake_warehouse (str): Default Snowflake warehouse for the session.
        snowflake_database (str): Snowflake database name.
        project_name (str): Name of the project.
        environment_name (str): Environment name (e.g., 'UAT', 'PRD').
        project_id (str): Project ID.
        snowflake_schema (str): Snowflake schema name.
        snowflake_stage_full_path (str): Fully qualified name of the target stage for deployment.
        streamlit_name (str): Name of the Streamlit app.
        streamlit_entrypoint (str): The main entry point file for the Streamlit app.
        streamlit_title (str): Title of the Streamlit app.
        streamlit_query_warehouse (str): Warehouse for executing queries in the app.

    Raises:
        ValueError: If the root folder is not a valid directory.
    """

    root_folder = os.path.abspath(root_folder)
    if not os.path.isdir(root_folder):
        raise ValueError("Invalid root folder: %s" % root_folder)

    print("Using root folder %s" % root_folder)
    print("Using Snowflake account %s" % snowflake_account)
    print("Using default role %s" % snowflake_role)
    print("Using deployment warehouse %s" % snowflake_warehouse)
    print("Using query warehouse %s" % streamlit_query_warehouse)
    
    # create connection
    con = create_connection(snowflake_database = snowflake_database, project_id = project_id, environment_name = environment_name)
    # create stage for the files if the stage does not exist yet
    if create_streamlit_stage_if_not_exists(con = con, snowflake_stage_full_path = snowflake_stage_full_path):
      # publish the files to the stage on Snowflake
        if publish_sis_files(con = con, environment_name = environment_name, project_name = project_name, sis_src_folder = root_folder, snowflake_stage_full_path = snowflake_stage_full_path):
          # create the Streamlit application  
          create_streamlit_app(con = con, snowflake_database = snowflake_database, snowflake_schema = snowflake_schema, streamlit_title = streamlit_title, streamlit_name = streamlit_name, snowflake_stage_full_path = snowflake_stage_full_path, streamlit_entrypoint = streamlit_entrypoint, streamlit_query_warehouse = streamlit_query_warehouse)

    if con:
        con.close()
        
def main():

    # set os.environ variables
    set_environ_variables(args.snowflake_account, args.snowflake_user, args.snowflake_role, args.snowflake_warehouse)

    # get config
    config = load_config(args)
    
    # deploy Streamlit App
    streamlit_deploy(
        root_folder = args.root_folder, 
        snowflake_account = args.snowflake_account,
        snowflake_role = args.snowflake_role, 
        snowflake_warehouse = args.snowflake_warehouse, 
        snowflake_database = config.snowflake_database, 
        project_name = args.project_name, 
        environment_name = args.environment_name, 
        project_id = args.project_id, 
        snowflake_schema = config.snowflake_schema,  
        snowflake_stage_full_path = config.snowflake_stage_full_path, 
        streamlit_name = config.streamlit_name, 
        streamlit_entrypoint = config.streamlit_entrypoint, 
        streamlit_title = config.streamlit_title, 
        streamlit_query_warehouse = config.streamlit_query_warehouse
      )

if __name__ == "__main__":
    main()
