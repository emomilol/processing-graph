-- Clear all tables
-- DROP TABLE IF EXISTS task_execution_map;
-- DROP TABLE IF EXISTS task_to_routine_map;
-- DROP TABLE IF EXISTS task_execution;
-- DROP TABLE IF EXISTS routine_execution;
-- DROP TABLE IF EXISTS server_to_server_communication_map;
-- DROP TABLE IF EXISTS server_snapshot;
-- DROP TABLE IF EXISTS server;
-- DROP TABLE IF EXISTS directional_task_graph_map;
-- DROP TABLE IF EXISTS deputy_task_map;
-- DROP TABLE IF EXISTS task;
-- DROP TABLE IF EXISTS routine;
-- DROP TABLE IF EXISTS contract;
-- DROP TABLE IF EXISTS agent;
-- DROP TABLE IF EXISTS context;
-- DROP TABLE IF EXISTS processing_graph;

CREATE TABLE IF NOT EXISTS processing_graph (
    name VARCHAR(255) PRIMARY KEY,
    description TEXT default '',
    modified TIMESTAMP DEFAULT now(),
    deleted BOOLEAN DEFAULT FALSE,
    created TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task (
    uuid UUID default gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    function_string TEXT NOT NULL,
    layer_index INT CHECK ( layer_index > -1 ) NOT NULL,
    processing_graph VARCHAR(255) REFERENCES processing_graph(name) ON DELETE CASCADE NOT NULL,
    is_unique BOOLEAN DEFAULT FALSE,
    concurrency INT DEFAULT 0,
    on_fail_task_id UUID REFERENCES task(uuid) ON DELETE SET DEFAULT DEFAULT NULL,
    created TIMESTAMP DEFAULT now(),
    deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_task_constraint UNIQUE (name, processing_graph, function_string)
);

CREATE TABLE IF NOT EXISTS directional_task_graph_map (
    task_id UUID REFERENCES task(uuid) ON DELETE CASCADE NOT NULL,
    predecessor_task_id UUID REFERENCES task(uuid) ON DELETE CASCADE NOT NULL,
    created TIMESTAMP DEFAULT now(),
    PRIMARY KEY (task_id, predecessor_task_id)
);

CREATE TABLE  IF NOT EXISTS deputy_task_map (
    task_id UUID REFERENCES task(uuid) ON DELETE CASCADE NOT NULL,
    deputy_task_id UUID REFERENCES task(uuid) ON DELETE CASCADE NOT NULL,
    created TIMESTAMP DEFAULT now(),
    PRIMARY KEY (task_id, deputy_task_id)
);

CREATE TABLE IF NOT EXISTS routine (
    uuid UUID default gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    processing_graph VARCHAR(255) REFERENCES processing_graph(name) ON DELETE CASCADE NOT NULL,
    created TIMESTAMP DEFAULT now(),
    deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_routine_constraint UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS task_to_routine_map (
    task_id UUID REFERENCES task(uuid) ON DELETE CASCADE NOT NULL ,
    routine_id UUID REFERENCES routine(uuid) ON DELETE CASCADE NOT NULL,
    created TIMESTAMP DEFAULT now(),
    PRIMARY KEY (task_id, routine_id)
);

-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS context (
   uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
   context JSONB NOT NULL -- encrypt
);

CREATE TABLE IF NOT EXISTS agent (
    uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created TIMESTAMP DEFAULT now(),
    deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_agent UNIQUE (name, description)
);

CREATE TABLE IF NOT EXISTS contract (
    uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES agent(uuid),
    context UUID REFERENCES context(uuid) ON DELETE NO ACTION NOT NULL,
    product VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP DEFAULT now(),
    created TIMESTAMP DEFAULT now(),
    fulfilled BOOLEAN DEFAULT FALSE,
    fulfilled_at TIMESTAMP DEFAULT NULL,
    result_context UUID REFERENCES context(uuid) ON DELETE NO ACTION DEFAULT NULL,
    from_url TEXT DEFAULT NULL,
    headers TEXT DEFAULT NULL,
    method VARCHAR(100) DEFAULT NULL,
    credentials VARCHAR(100) DEFAULT NULL,
    mode VARCHAR(100) DEFAULT NULL,
    referer TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS server (
    uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    address TEXT NOT NULL,
    port INT NOT NULL,
    process_pid INT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    processing_graph VARCHAR(255) REFERENCES processing_graph(name) ON DELETE NO ACTION NOT NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_non_responsive BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created TIMESTAMP DEFAULT now(),
    modified TIMESTAMP DEFAULT now(),
    deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_server_constraint UNIQUE (address, port, process_pid)
);

CREATE TABLE IF NOT EXISTS server_snapshot (
    server_id UUID REFERENCES server(uuid) ON DELETE CASCADE NOT NULL,
    cpu DECIMAL(3,2) CONSTRAINT check_server_snapshot_cpu CHECK (cpu BETWEEN 0 AND 1) NOT NULL,
    gpu DECIMAL(3,2) CONSTRAINT check_server_snapshot_gpu CHECK (gpu BETWEEN 0 AND 1) DEFAULT 0.00,
    ram BIGINT NOT NULL,
    timestamp TIMESTAMP DEFAULT now(),
    PRIMARY KEY (server_id, timestamp)
);

CREATE TABLE IF NOT EXISTS server_to_server_communication_map (
    server_id UUID REFERENCES server(uuid) ON DELETE CASCADE NOT NULL,
    server_client_id UUID REFERENCES server(uuid) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (server_id, server_client_id)
);

CREATE TABLE IF NOT EXISTS routine_execution (
    uuid UUID PRIMARY KEY,
    server_id UUID REFERENCES server(uuid) ON DELETE NO ACTION NOT NULL,
    routine_id UUID REFERENCES routine(uuid) ON DELETE NO ACTION DEFAULT NULL,
    contract_id UUID REFERENCES contract(uuid) ON DELETE NO ACTION DEFAULT NULL,
    description TEXT NOT NULL,
    is_scheduled BOOLEAN DEFAULT TRUE,
    is_running BOOLEAN DEFAULT FALSE,
    is_complete BOOLEAN DEFAULT FALSE,
    errored BOOLEAN DEFAULT FALSE,
    failed BOOLEAN DEFAULT FALSE,
    reached_timeout BOOLEAN DEFAULT FALSE,
    request_url TEXT DEFAULT NULL,
    progress DECIMAL(3,2) CONSTRAINT check_routine_execution_progress CHECK ( progress BETWEEN 0 AND 1) DEFAULT 0.00,
    previous_routine_execution UUID REFERENCES routine_execution (uuid) ON DELETE SET DEFAULT DEFAULT NULL,
    created TIMESTAMP DEFAULT now(),
    ended TIMESTAMP DEFAULT NULL,
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS previous_routine_execution ON routine_execution(previous_routine_execution);

CREATE TABLE IF NOT EXISTS task_execution (
    uuid UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_execution_id UUID REFERENCES routine_execution(uuid) ON DELETE NO ACTION NOT NULL,
    task_id UUID REFERENCES task(uuid) ON DELETE NO ACTION NOT NULL,
    context_id UUID REFERENCES context(uuid) ON DELETE NO ACTION NOT NULL,
    result_context_id UUID REFERENCES context(uuid) ON DELETE NO ACTION DEFAULT NULL,
    is_scheduled BOOLEAN DEFAULT TRUE,
    is_running BOOLEAN DEFAULT FALSE,
    is_complete BOOLEAN DEFAULT FALSE,
    errored BOOLEAN DEFAULT FALSE,
    failed BOOLEAN DEFAULT FALSE,
    reached_timeout BOOLEAN DEFAULT FALSE,
    error_message TEXT DEFAULT NULL,
    progress DECIMAL(3,2) CONSTRAINT check_task_execution_progress CHECK ( progress BETWEEN 0 AND 1) DEFAULT 0.00,
    created TIMESTAMP DEFAULT now(),
    started TIMESTAMP DEFAULT NULL,
    ended TIMESTAMP DEFAULT NULL,
    deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_task_execution UNIQUE (routine_execution_id, task_id, context_id)
);

CREATE TABLE IF NOT EXISTS task_execution_map (
    task_execution_id UUID REFERENCES task_execution(uuid) ON DELETE CASCADE NOT NULL,
    previous_task_execution_id UUID REFERENCES task_execution(uuid) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (task_execution_id, previous_task_execution_id)
);
