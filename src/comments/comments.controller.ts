import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  CommentResponseDto,
  CommentsResponseDto,
} from './serializers/comment.serializer';

@ApiTags('Comments')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add Comments to an Article (Tạo bình luận mới)' })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID của bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Thêm bình luận thành công',
    type: CommentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Nội dung bình luận không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async create(
    @Param('slug') slug: string,
    @Req() req: Request & { user: User },
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(slug, req.user.id, createCommentDto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get Comments from an Article (Danh sách bình luận của bài viết)',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID của bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách bình luận thành công',
    type: CommentsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async findAll(
    @Param('slug') slug: string,
    @Req() req: Request & { user?: User },
  ): Promise<CommentsResponseDto> {
    return this.commentsService.findAll(slug, req.user?.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete Comment (Xóa bình luận)' })
  @ApiParam({
    name: 'slug',
    description: 'Slug hoặc ID của bài viết',
    example: 'how-to-build-nestjs-crud-api-a1b2c3d4',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của bình luận cần xóa',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'Xóa bình luận thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xóa bình luận của người khác',
  })
  @ApiResponse({ status: 404, description: 'Bình luận không tồn tại' })
  async delete(
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
  ): Promise<{ message: string }> {
    return this.commentsService.delete(slug, id, req.user.id);
  }
}
