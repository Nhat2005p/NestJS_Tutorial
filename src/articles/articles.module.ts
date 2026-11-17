import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from '../attachments/attachments.module';
import { Follow } from '../users/entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Article } from './entities/article.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, ArticleFavorite, User, Follow]),
    AttachmentsModule,
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
