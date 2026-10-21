import type { JwtPayload } from '@edu-lanka/shared-types';
import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { CreateHomeworkDto, SubmitHomeworkDto, GradeHomeworkDto, UploadHomeworkAttachmentDto } from './dto/homework.dto';
import { HomeworkService } from './homework.service';

@ApiTags('Homework')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('homework')
export class HomeworkController {
    constructor(private readonly homeworkService: HomeworkService) { }

    @Get()
    @ApiOperation({ summary: 'List homework tasks scoped to caller class/role' })
    @ApiQuery({ name: 'classId', required: false, type: String, description: 'Optional class UUID filter' })
    listTasks(@CurrentUser() user: JwtPayload, @Query('classId') classId?: string) {
        return this.homeworkService.listTasks(user, classId);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Assign a new homework task to a class (Teachers & Admins)' })
    createTask(@CurrentUser() user: JwtPayload, @Body() dto: CreateHomeworkDto) {
        return this.homeworkService.createTask(dto, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get details of a specific homework task' })
    getTask(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.homeworkService.getTaskById(id, user);
    }

    @Post(':id/submit')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit solution for a homework task (Students)' })
    submitTask(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: SubmitHomeworkDto,
    ) {
        return this.homeworkService.submitTask(id, dto, user);
    }

    @Get(':id/submissions')
    @ApiOperation({ summary: 'View all submissions for a homework task (Teachers & Admins)' })
    getSubmissions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
        return this.homeworkService.getSubmissions(id, user);
    }

    @Patch('submissions/:id/grade')
    @ApiOperation({ summary: 'Grade or review a student submission (Teachers & Admins)' })
    gradeSubmission(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: GradeHomeworkDto,
    ) {
        return this.homeworkService.gradeSubmission(id, dto, user);
    }

    @Post('attachments')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Upload an attachment for a homework task or submission' })
    uploadAttachment(
        @CurrentUser() user: JwtPayload,
        @Body() dto: UploadHomeworkAttachmentDto,
    ) {
        return this.homeworkService.uploadHomeworkAttachment(dto, user);
    }

    @Post('upload')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Alias endpoint for homework attachment upload' })
    uploadAttachmentAlias(
        @CurrentUser() user: JwtPayload,
        @Body() dto: UploadHomeworkAttachmentDto,
    ) {
        return this.homeworkService.uploadHomeworkAttachment(dto, user);
    }
}
