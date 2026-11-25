import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({
    example: 'How to build NestJS CRUD API',
    description: 'Tiêu đề bài viết',
  })
  @IsNotEmpty({ message: 'Tiêu đề bài viết không được để trống' })
  @IsString({ message: 'Tiêu đề bài viết phải là chuỗi' })
  title: string;

  @ApiProperty({
    example: 'Học cách xây dựng CRUD Articles chuẩn RESTful',
    description: 'Mô tả ngắn gọn bài viết',
  })
  @IsNotEmpty({ message: 'Mô tả bài viết không được để trống' })
  @IsString({ message: 'Mô tả bài viết phải là chuỗi' })
  description: string;

  @ApiProperty({
    example: 'Nội dung chi tiết bài viết với NestJS và TypeORM...',
    description: 'Nội dung bài viết',
  })
  @IsNotEmpty({ message: 'Nội dung bài viết không được để trống' })
  @IsString({ message: 'Nội dung bài viết phải là chuỗi' })
  body: string;

  @ApiPropertyOptional({
    example: ['nestjs', 'typescript', 'backend'],
    type: [String],
    description: 'Danh sách các thẻ tag',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagList?: string[];
}
