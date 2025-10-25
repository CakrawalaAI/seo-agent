import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Sql, Options } from 'postgres';
import { s as schema } from './schema-DhPSx9PP.cjs';
import 'drizzle-orm/pg-core';

type Database = PostgresJsDatabase<typeof schema>;
type SqlClient = Sql<any> & {
    end: () => Promise<void>;
};
type CreateDbClientOptions = {
    url?: string;
    postgresOptions?: Options<any>;
};
declare const DEFAULT_DATABASE_URL: string;
declare const createSqlClient: (url?: string, options?: Options<any>) => SqlClient;
declare const createDb: (options?: CreateDbClientOptions) => {
    db: Database;
    sql: SqlClient;
};
type Schema = typeof schema;

export { type CreateDbClientOptions, DEFAULT_DATABASE_URL, type Database, type Schema, type SqlClient, createDb, createSqlClient, schema };
