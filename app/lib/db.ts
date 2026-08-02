import mysql, {
  Connection,
  Pool,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";

const host = process.env.LOCAL_DB_HOST || "localhost";
const user = process.env.LOCAL_DB_USER || "root";
const password = process.env.LOCAL_DB_PASSWORD || "";
const DB_NAME = process.env.LOCAL_DB_NAME || "finops_pilot_local_db";

// Extend the NodeJS Global interface to cache the pool and init promise in development (prevents double-connections on HMR)
declare global {
  var _mysqlPool: Pool | undefined;
  var _dbInitPromise: Promise<void> | undefined;
}

let pool: Pool;

async function initDB(): Promise<void> {
  let connection: Connection | null = null;

  try {
    // 1. Connect without selecting a DB to ensure the database exists
    connection = await mysql.createConnection({
      host,
      user,
      password,
    });

    // 2. Create Database if missing
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  } catch (error) {
    console.error(
      `[db] Error while connecting to MySQL or creating database \`${DB_NAME}\``,
      error,
    );
    throw error;
  } finally {
    if (connection) {
      await connection.end().catch((closeError: unknown) => {
        console.error(
          "[db] Error while closing bootstrap DB connection",
          closeError,
        );
      });
    }
  }

  // 3. Instantiate Connection Pool
  pool = mysql.createPool({
    host,
    user,
    password,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  global._mysqlPool = pool;

  // 4. Create "users" table with generated column
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(100) NOT NULL UNIQUE,
      mobile_number VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      prava_user_id VARCHAR(150) GENERATED ALWAYS AS (CONCAT('finops_pilot_user_', username)) STORED UNIQUE,
      client_token VARCHAR(200) GENERATED ALWAYS AS (CONCAT(CONCAT('finops_pilot_user_', username), '_clienttoken')) STORED UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  // 5. Create "events" table with default prefilled values
  const createEventsTable = `
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      prava_user_id VARCHAR(150) NOT NULL,
      inc_merchant_name VARCHAR(255) NOT NULL,
      inc_merchant_status VARCHAR(100) NOT NULL,
      inc_merchant_pricing_url TEXT NOT NULL,
      
      /* Prefilled default columns */
      payment_amount DECIMAL(10, 2) DEFAULT 0.00,
      prava_session_id VARCHAR(255) DEFAULT NULL,
      agent_job_id VARCHAR(255) DEFAULT NULL,
      agent_final_payment_status VARCHAR(50) DEFAULT 'pending',
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  // 6. Create "mandates" table
  const createMandatesTable = `
    CREATE TABLE IF NOT EXISTS mandates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      prava_user_id VARCHAR(150) NOT NULL,
      merchant_name VARCHAR(255) NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      frequency VARCHAR(50) NOT NULL DEFAULT '',
      charges_total INT NOT NULL DEFAULT 0,
      charges_made INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  await pool.query(createUsersTable);
  await pool.query(createEventsTable);
  await pool.query(createMandatesTable);

  console.info(`${DB_NAME} DB initialization completed`);
}

// Ensure database initialization runs once per application lifecycle
if (!global._dbInitPromise) {
  global._dbInitPromise = initDB().catch((err: Error) => {
    console.error(`[db] Failed to initialize database \`${DB_NAME}\``, err);
    throw err;
  });
}

// Strongly typed query wrapper supporting standard rows or insert result headers
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[],
): Promise<T> {
  await global._dbInitPromise;

  const currentPool = global._mysqlPool || pool;
  if (!currentPool) {
    throw new Error("Database pool has not been initialized.");
  }

  const [results] = await currentPool.execute<T>(sql, params);
  return results;
}

export async function ensureDBReady(): Promise<void> {
  await global._dbInitPromise;
}

export default pool!;
