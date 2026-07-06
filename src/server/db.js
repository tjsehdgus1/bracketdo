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

  // 단일 문장 CTE로 원자적 처리. UPDATE로 CTE 삽입 행을 참조할 수 없으므로(스냅샷 공유)
  // id를 선생성해 양쪽 INSERT에 직접 넣는다. FK 검사는 문장 끝에 수행되므로 상호 참조 가능.
  async createClubManagerWithDojo(u, d) {
    const rows = await sql`
      WITH ids AS (
        SELECT gen_random_uuid() AS uid, gen_random_uuid() AS did
      ),
      new_dojo AS (
        INSERT INTO dojos (id, name, sido_code, sido_name, sigungu_code, sigungu_name, owner_id)
        SELECT did, ${d.name}, ${d.sido_code}, ${d.sido_name}, ${d.sigungu_code}, ${d.sigungu_name}, uid
        FROM ids
        RETURNING id
      ),
      ins_user AS (
        INSERT INTO users
          (id, email, password_hash, name, phone, sido_code, sido_name, sigungu_code, sigungu_name, dojo_id, role)
        SELECT uid, ${u.email}, ${u.password_hash}, ${u.name}, ${u.phone}, ${u.sido_code}, ${u.sido_name},
               ${u.sigungu_code}, ${u.sigungu_name}, did, ${u.role}
        FROM ids
        RETURNING *
      )
      SELECT * FROM ins_user`;
    const user = rows[0];
    return { user, dojo: { id: user.dojo_id, ...d } };
  },
};
