import { DataSource } from 'typeorm';

/**
 * Xóa sạch toàn bộ dữ liệu trong tất cả các bảng của database test
 * Phục vụ cho yêu cầu: "truncate db sau mỗi test case"
 */
export async function truncateDatabase(dataSource: DataSource): Promise<void> {
  if (!dataSource || !dataSource.isInitialized) {
    return;
  }

  const entities = dataSource.entityMetadatas;
  const dbType = dataSource.options.type;
  const isSqlite = dbType === 'sqljs' || dbType === 'sqlite';

  if (isSqlite) {
    await dataSource.query('PRAGMA foreign_keys = OFF');
    for (const entity of entities) {
      await dataSource.query(`DELETE FROM "${entity.tableName}"`);
    }
    await dataSource.query('PRAGMA foreign_keys = ON');
  } else {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const entity of entities) {
      await dataSource.query(`TRUNCATE TABLE \`${entity.tableName}\``);
    }
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}
