import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import {
  ArticleResponseDto,
  ArticlesResponseDto,
} from './serializers/article.serializer';

@ApiTags('Articles')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Article (Tạo bài viết mới)' })
  @ApiResponse({
    status: 201,
    description: 'Tạo bài viết thành công',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực người dùng' })
  async create(
    @Req() req: Request & { user: User },
    @Body() createArticleDto: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.create(req.user.id, createArticleDto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List Articles (Lấy danh sách bài viết theo bộ lọc tag, author, favorited, phân trang)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách bài viết',
    type: ArticlesResponseDto,
  })
  async findAll(
    @Query() query: QueryArticlesDto,
    @Req() req: Request,
  ): Promise<ArticlesResponseDto> {
    const currentUserId = (req as any).user?.id;
    return this.articlesService.findAll(query, currentUserId);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Feed Articles (Lấy danh sách bài viết của những tác giả mình theo dõi)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách bài viết trên feed',
    type: ArticlesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực người dùng' })
  async findFeed(
    @Req() req: Request & { user: User },
    @Query() query: QueryFeedDto,
  ): Promise<ArticlesResponseDto> {
    return this.articlesService.findFeed(req.user.id, query);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Article (Xem chi tiết một bài viết)' })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết bài viết',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async findOne(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<ArticleResponseDto> {
    const currentUserId = (req as any).user?.id;
    return this.articlesService.findBySlugOrId(slug, currentUserId);
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update Article (Cập nhật bài viết của chính mình)',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật bài viết thành công',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực người dùng' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền chỉnh sửa bài viết của người khác',
  })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async update(
    @Param('slug') slug: string,
    @Req() req: Request & { user: User },
    @Body() updateArticleDto: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.update(slug, req.user.id, updateArticleDto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete Article (Xóa bài viết của chính mình)' })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa bài viết thành công',
    schema: { example: { message: 'Xóa bài viết thành công' } },
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực người dùng' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xóa bài viết của người khác',
  })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async delete(
    @Param('slug') slug: string,
    @Req() req: Request & { user: User },
  ): Promise<{ message: string }> {
    return this.articlesService.delete(slug, req.user.id);
  }

  @Post(':slug/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Favorite Article (Thích / Yêu thích một bài viết)',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Thích bài viết thành công',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực người dùng' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async favorite(
    @Param('slug') slug: string,
    @Req() req: Request & { user: User },
  ): Promise<ArticleResponseDto> {
    return this.articlesService.favorite(slug, req.user.id);
  }

  @Delete(':slug/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unfavorite Article (Hủy thích / Hủy yêu thích một bài viết)',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Hủy thích bài viết thành công',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực người dùng' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async unfavorite(
    @Param('slug') slug: string,
    @Req() req: Request & { user: User },
  ): Promise<ArticleResponseDto> {
    return this.articlesService.unfavorite(slug, req.user.id);
  }
}
