import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Article } from './article.entity';

@Entity('article_favorites')
@Unique('UQ_USER_ARTICLE_FAVORITE', ['userId', 'articleId'])
export class ArticleFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('IDX_FAVORITE_USER')
  @Column({ name: 'user_id' })
  userId: number;

  @Index('IDX_FAVORITE_ARTICLE')
  @Column({ name: 'article_id' })
  articleId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article: Article;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
