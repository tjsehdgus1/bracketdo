import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const db = {
  async emailExists(email) {
    const rows = await sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`;
    return rows.length > 0;
  },

  async getUserByEmail(email) {
    const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    return rows[0] ?? null;
  },

  async getUserById(id) {
    const rows = await sql`
      SELECT u.*, d.name AS dojo_name
      FROM users u LEFT JOIN dojos d ON d.id = u.dojo_id
      WHERE u.id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  },

  async findDojoById(id) {
    const rows = await sql`SELECT * FROM dojos WHERE id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  },

  async findDojoByNameRegion(name, sidoCode, sigunguCode) {
    const rows = await sql`
      SELECT * FROM dojos
      WHERE name = ${name} AND sido_code = ${sidoCode} AND sigungu_code = ${sigunguCode}
      LIMIT 1`;
    return rows[0] ?? null;
  },

  async listDojos(sidoCode, sigunguCode) {
    if (sidoCode && sigunguCode) {
      return sql`SELECT id, name FROM dojos
        WHERE sido_code = ${sidoCode} AND sigungu_code = ${sigunguCode}
        ORDER BY name`;
    }
    return sql`SELECT id, name FROM dojos ORDER BY name LIMIT 200`;
  },

  async createUser(u) {
    const rows = await sql`
      INSERT INTO users
        (email, password_hash, name, phone, sido_code, sido_name, sigungu_code, sigungu_name, dojo_id, role)
      VALUES
        (${u.email}, ${u.password_hash}, ${u.name}, ${u.phone}, ${u.sido_code}, ${u.sido_name},
         ${u.sigungu_code}, ${u.sigungu_name}, ${u.dojo_id ?? null}, ${u.role})
      RETURNING *`;
    return rows[0];
  },

  // 단일 문장 CTE로 원자적 처리: 유저 생성 → 검도관 생성(owner=유저) → 유저.dojo_id 갱신
  async createClubManagerWithDojo(u, d) {
    const rows = await sql`
      WITH new_user AS (
        INSERT INTO users
          (email, password_hash, name, phone, sido_code, sido_name, sigungu_code, sigungu_name, role)
        VALUES
          (${u.email}, ${u.password_hash}, ${u.name}, ${u.phone}, ${u.sido_code}, ${u.sido_name},
           ${u.sigungu_code}, ${u.sigungu_name}, ${u.role})
        RETURNING id
      ),
      new_dojo AS (
        INSERT INTO dojos (name, sido_code, sido_name, sigungu_code, sigungu_name, owner_id)
        SELECT ${d.name}, ${d.sido_code}, ${d.sido_name}, ${d.sigungu_code}, ${d.sigungu_name}, id
        FROM new_user
        RETURNING id
      )
      UPDATE users SET dojo_id = (SELECT id FROM new_dojo)
      WHERE id = (SELECT id FROM new_user)
      RETURNING *`;
    const user = rows[0];
    return { user, dojo: { id: user.dojo_id, ...d } };
  },
};
