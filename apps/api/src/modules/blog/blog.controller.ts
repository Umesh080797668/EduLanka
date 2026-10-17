import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@edu-lanka/shared-types';
import { BlogService } from './blog.service';
import { CreateBlogDto, BlogScope } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReactionDto } from './dto/reaction.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';
import { ReportBlogDto } from './dto/report-blog.dto';
import { TakedownBlogDto } from './dto/takedown-blog.dto';

@ApiTags('Educational Blogs & Academic Discourse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('blogs')
export class BlogController {
    constructor(private readonly blogService: BlogService) { }

    @Get()
    @ApiOperation({ summary: 'List educational blogs (Class, School, Platform)' })
    listBlogs(
        @CurrentUser() user: JwtPayload,
        @Query('scope') scope?: BlogScope,
        @Query('classId') classId?: string,
        @Query('tag') tag?: string,
        @Query('search') search?: string,
    ) {
        return this.blogService.listBlogs(user, { scope, classId, tag, search });
    }

    @Get('reports')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'List flagged blog reports (Admins only)' })
    listReports(
        @CurrentUser() user: JwtPayload,
        @Query('blogId') blogId?: string,
    ) {
        return this.blogService.listReports(user, blogId);
    }

    @Patch('reports/:reportId')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Resolve or dismiss a blog report (Admins only)' })
    resolveReport(
        @CurrentUser() user: JwtPayload,
        @Param('reportId') reportId: string,
        @Body('status') status: 'RESOLVED' | 'DISMISSED',
    ) {
        return this.blogService.resolveReport(reportId, status, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get educational blog post by ID with threaded comments and reactions' })
    getBlogById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.blogService.getBlogById(id, user);
    }

    @Post()
    @Roles(UserRole.TEACHER)
    @ApiOperation({ summary: 'Compose a new educational blog post (Teachers only)' })
    createBlog(@CurrentUser() user: JwtPayload, @Body() dto: CreateBlogDto) {
        return this.blogService.createBlog(dto, user);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update an existing blog post (Author/Admins)' })
    updateBlog(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: UpdateBlogDto,
    ) {
        return this.blogService.updateBlog(id, dto, user);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Soft-delete an educational blog post' })
    deleteBlog(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.blogService.deleteBlog(id, user);
    }

    @Post(':id/reactions')
    @ApiOperation({ summary: 'Add or toggle academic reaction on a blog post or comment' })
    toggleReaction(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: ReactionDto,
    ) {
        return this.blogService.toggleReaction(id, dto, user);
    }

    @Delete(':id/reactions')
    @ApiOperation({ summary: 'Remove academic reaction from a blog post or comment' })
    removeReaction(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Query('commentId') commentId?: string,
    ) {
        return this.blogService.removeReaction(id, user, commentId);
    }

    @Post(':id/comments')
    @ApiOperation({ summary: 'Post a comment or nested reply on a blog post' })
    createComment(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: CreateCommentDto,
    ) {
        return this.blogService.createComment(id, dto, user);
    }

    @Patch('comments/:commentId/moderate')
    @ApiOperation({ summary: 'Moderate comment (Hide/Pin) - Teachers/Admins' })
    moderateComment(
        @CurrentUser() user: JwtPayload,
        @Param('commentId') commentId: string,
        @Body() dto: ModerateCommentDto,
    ) {
        return this.blogService.moderateComment(commentId, dto, user);
    }

    @Delete('comments/:commentId')
    @ApiOperation({ summary: 'Delete a comment or reply' })
    deleteComment(
        @CurrentUser() user: JwtPayload,
        @Param('commentId') commentId: string,
    ) {
        return this.blogService.deleteComment(commentId, user);
    }

    @Post(':id/report')
    @ApiOperation({ summary: 'Report an educational blog post for review' })
    reportBlog(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: ReportBlogDto,
    ) {
        return this.blogService.reportBlog(id, dto, user);
    }

    @Patch(':id/takedown')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Administrative takedown of an educational blog post (School Admin / Super Admin)' })
    takedownBlog(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: TakedownBlogDto,
    ) {
        return this.blogService.takedownBlog(id, dto, user);
    }

    @Patch(':id/restore')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Restore a taken-down educational blog post (School Admin / Super Admin)' })
    restoreBlog(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
    ) {
        return this.blogService.restoreBlog(id, user);
    }
}
