import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Follow } from '../users/entities/follow.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { Article } from '../articles/entities/article.entity';
import { ArticleFavorite } from '../articles/entities/article-favorite.entity';
import { Comment } from '../comments/entities/comment.entity';
import { CreateUsersTable1700000000000 } from './migrations/1700000000000-CreateUsersTable';
import { CreateAttachmentsAndFollowsTable1700000000002 } from './migrations/1700000000002-CreateAttachmentsAndFollowsTable';
import { CreateArticlesAndFavoritesTable1700000000003 } from './migrations/1700000000003-CreateArticlesAndFavoritesTable';
import { CreateCommentsTable1700000000004 } from './migrations/1700000000004-CreateCommentsTable';

export const getDataSourceOptions = (): DataSourceOptions => {
  const dbType = process.env.DB_TYPE || 'mysql';

  if (dbType === 'sqljs') {
    return {
      type: 'sqljs',
      location: process.env.DB_DATABASE || 'database.sqlite',
      autoSave: true,
      entities: [User, Follow, Attachment, Article, ArticleFavorite, Comment],
      migrations: [
        CreateUsersTable1700000000000,
        CreateAttachmentsAndFollowsTable1700000000002,
        CreateArticlesAndFavoritesTable1700000000003,
        CreateCommentsTable1700000000004,
      ],
      synchronize: false,
    };
  }

  return {
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'nestjs_tutorial',
    entities: [User, Follow, Attachment, Article, ArticleFavorite, Comment],
    migrations: [
      CreateUsersTable1700000000000,
      CreateAttachmentsAndFollowsTable1700000000002,
      CreateArticlesAndFavoritesTable1700000000003,
      CreateCommentsTable1700000000004,
    ],
    synchronize: false,
  };
};

export const dataSourceOptions: DataSourceOptions = getDataSourceOptions();

const AppDataSource = new DataSource(getDataSourceOptions());
export default AppDataSource;
