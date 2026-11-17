import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryArticlesDto {
  @ApiPropertyOptional({
    description: 'Lọc bài viết theo tag',
    example: 'nestjs',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Lọc bài viết theo tác giả (name, email hoặc id)',
    example: 'Minh Nhat',
  })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    description: 'Lọc bài viết được yêu thích bởi user',
    example: 'user2@example.com',
  })
  @IsOptional()
  @IsString()
  favorited?: string;

  @ApiPropertyOptional({
    description: 'Số lượng bài viết trên một trang',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Số lượng bài viết bỏ qua (phân trang)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
