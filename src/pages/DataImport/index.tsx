import { friendlyError } from '../../lib/errorMessages';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download,
  UploadCloud,
  FileSpreadsheet,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  PlayCircle,
  AlertTriangle,
  Pencil,
  Ban,
  Undo2,
  FileDown,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';

import { useAuth } from '../../hooks/useAuth';
import { useBranchContext } from '../../lib/branchContext';
import type { ParsedRow, ImportSummary } from './types';
import { downloadTemplateFile, parseWorkbookFile, importRows, fetchImportAgents, exportErrorReport, revalidateRow, type ImportAgent } from './services/dataImportService';
import { detectDocumentKind, extractRowsFromDocument } from './services/aiDocumentExtractor';
import { RowEditModal } from './components/RowEditModal';
import { createAppJob, finishAppJob, updateAppJob } from '../../features/jobs/jobService';
import {
  cleanupImportResumeData,
  createImportCheckpoint,
  downloadCheckpointFile,
  getCompletedImportRowNumbers,
  getImportCheckpoint,
  updateImportCheckpoint,
} from '../../features/jobs/importResumeService';

type Stage = 'idle' | 'parsed' | 'importing' | 'done';

export function DataImport() {
  const { user } = useAuth();
  const { currentBranchId } = useBranchContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeLoadedRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [agents, setAgents] = useState<ImportAgent[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [editingRow, setEditingRow] = useState<ParsedRow | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [retryMode, setRetryMode] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [parsing, setParsing] = useState(false);
  const activeJobIdRef = useRef<string | null>(null);
  const activeBranchIdRef = useRef<string | null>(null);
  const resumeAvailableRef = useRef(false);
  const [aiExtractionProgress, setAiExtractionProgress] = useState<{
    processedPages: number;
    totalPages: number;
    extractedRows: number;
    provider?: string;
    model?: string;
  } | null>(null);

  const safeUpdateJob = (jobId: string | null, patch: Parameters<typeof updateAppJob>[1]) => {
    if (!jobId) return;
    void updateAppJob(jobId, patch).catch((err) => console.warn('Job Center update failed:', err));
  };

  const safeFinishJob = (
    jobId: string | null,
    status: Parameters<typeof finishAppJob>[1],
    message?: string,
    current?: number,
    total?: number,
    metadata?: Record<string, unknown>,
  ) => {
    if (!jobId) return;
    void finishAppJob(jobId, status, message, current, total, metadata)
      .catch((err) => console.warn('Job Center finish failed:', err));
  };


  const safeUpdateCheckpoint = (
    jobId: string | null,
    patch: Parameters<typeof updateImportCheckpoint>[1],
  ) => {
    if (!jobId) return;
    void updateImportCheckpoint(jobId, patch)
      .catch((err) => console.warn('Import checkpoint update failed:', err));
  };

  const activeRows = parsedRows.filter((r) => !excludedRows.has(r.rowNumber));
  const validRowsCount = activeRows.filter((r) => r.payload !== null).length;
  const invalidRowsCount = activeRows.length - validRowsCount;
  const excludedCount = excludedRows.size;
  const duplicateRowsCount = activeRows.filter((r) => r.clientError?.includes('مكرر داخل الملف')).length;
  const agentIssueRowsCount = activeRows.filter((r) => r.clientError?.includes('الوكيل')).length;

  const resetAll = () => {
    setFileName(null);
    setHeaderError(null);
    setAiNotice(null);
    setParsedRows([]);
    setAgents([]);
    setExcludedRows(new Set());
    setEditingRow(null);
    setShowErrorsOnly(false);
    setRetryMode(false);
    setStage('idle');
    setProgress({ done: 0, total: 0 });
    setSummary(null);
    setAiExtractionProgress(null);
    activeJobIdRef.current = null;
    activeBranchIdRef.current = null;
    resumeAvailableRef.current = false;
    if (searchParams.has('resume')) {
      const next = new URLSearchParams(searchParams);
      next.delete('resume');
      setSearchParams(next, { replace: true });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    resetAll();
    setFileName(file.name);
    setParsing(true);
    const documentKind = detectDocumentKind(file);
    let jobId: string | null = null;
    if (user) {
      try {
        const job = await createAppJob({
          userId: user.id,
          branchId: currentBranchId,
          jobType: documentKind ? 'ai_document_extract' : 'data_import_prepare',
          title: documentKind ? `استخراج بيانات: ${file.name}` : `تحليل ملف: ${file.name}`,
          stage: documentKind ? 'تحليل المستند بالذكاء الاصطناعي' : 'قراءة الملف ومطابقة الأعمدة',
          message: 'بدأت المهمة',
          metadata: {
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || null,
            resumable: resumeAvailableRef.current,
          },
        });
        jobId = job.id;
        activeJobIdRef.current = job.id;
        activeBranchIdRef.current = currentBranchId;
        try {
          await createImportCheckpoint({
            jobId: job.id,
            userId: user.id,
            branchId: currentBranchId,
            file,
            documentKind: documentKind || 'spreadsheet',
          });
          resumeAvailableRef.current = true;
        } catch (checkpointErr) {
          console.warn('Import checkpoint create failed:', checkpointErr);
          resumeAvailableRef.current = false;
          safeUpdateJob(job.id, {
            metadata: {
              file_name: file.name,
              file_size: file.size,
              file_type: file.type || null,
              resumable: false,
            },
          });
        }
      } catch (jobErr) {
        console.warn('Job Center create failed:', jobErr);
      }
    }

    try {
      // نجيب قائمة وكلاء فريق المستورِد قبل التحليل عشان نطابق عمود "اسم
      // الوكيل" محلياً (تطبيع + تشابه) بدل ما نكتشف الاسم الغلط بعد فشل
      // كل صف في السيرفر واحداً واحداً
      const fetchedAgents = user ? await fetchImportAgents(user, currentBranchId) : [];
      setAgents(fetchedAgents);

      if (documentKind) {
        // ملف PDF أو صورة — لا تدعمه الطبقة الأولى أصلاً، فيُعالَج بالكامل
        // عبر طبقة الاستخراج بالذكاء الاصطناعي (لا يوجد "نظام حالي" بديل
        // لهذا النوع من الملفات تحديداً)
        const extraction = await extractRowsFromDocument(
          file,
          documentKind,
          fetchedAgents,
          (progress) => {
            setAiExtractionProgress(progress);
            safeUpdateJob(jobId, {
              stage: 'استخراج الصفحات',
              progress_current: progress.processedPages,
              progress_total: progress.totalPages,
              message: `تم استخراج ${progress.extractedRows} سجل حتى الآن`,
              metadata: {
                file_name: file.name,
                provider: progress.provider ?? null,
                model: progress.model ?? null,
                extracted_rows: progress.extractedRows,
                resumable: resumeAvailableRef.current,
              },
            });
          },
          {
            startPage: 1,
            existingRows: [],
            onCheckpoint: async (checkpoint) => {
              if (!jobId) return;
              try {
                await updateImportCheckpoint(jobId, {
                  phase: 'extracting',
                  processed_pages: checkpoint.processedPages,
                  total_pages: checkpoint.totalPages,
                  parsed_rows: checkpoint.rows,
                });
              } catch (checkpointErr) {
                console.warn('Page checkpoint save failed:', checkpointErr);
              }
            },
          },
        );
        if (extraction.error) {
          setHeaderError(extraction.error);
          setStage('idle');
          safeUpdateCheckpoint(jobId, {
            phase: 'failed',
            processed_pages: extraction.processedPages,
            total_pages: extraction.totalPages,
            parsed_rows: extraction.rows,
          });
          safeFinishJob(
            jobId,
            'failed',
            extraction.error,
            extraction.processedPages,
            extraction.totalPages,
            { file_name: file.name, extracted_rows: extraction.rows.length, resumable: true },
          );
        } else {
          setParsedRows(extraction.rows);

          if (extraction.partial && extraction.capacityExhausted) {
            setAiNotice(
              `تم استخراج ${extraction.processedPages} من ${extraction.totalPages} صفحة و${extraction.rows.length} سجل بنجاح، ثم انتهت الحصة المتاحة لدى كل نماذج ومزودي الذكاء الاصطناعي. يمكنك استيراد الجزء المستخرج الآن بأمان، وإعادة المحاولة لاحقاً للباقي.`
            );
          } else if (extraction.pageLimitReached) {
            setAiNotice(
              `تم تحليل أول ${extraction.processedPages} صفحة من أصل ${extraction.totalPages} واستخراج ${extraction.rows.length} سجل. لحماية أداء الهاتف والذاكرة، الحد الأقصى للملف الواحد هو 60 صفحة؛ قسّم الصفحات المتبقية في ملف ثانٍ ثم استوردها بعد ذلك.`
            );
          } else if (extraction.partial && extraction.processedPages < extraction.totalPages) {
            setAiNotice(
              `تم استخراج ${extraction.processedPages} من ${extraction.totalPages} صفحة و${extraction.rows.length} سجل. تم الاحتفاظ بكل ما اكتمل؛ راجع البيانات واستورد الجزء الجاهز، ثم أعد المحاولة للباقي لاحقاً.`
            );
          } else {
            setAiNotice(
              `تم استخراج بيانات الملف بالكامل بواسطة الذكاء الاصطناعي (${extraction.processedPages} صفحة، ${extraction.rows.length} سجل). راجع الصفوف أدناه بعناية قبل الاستيراد.`
            );
          }
          safeUpdateCheckpoint(jobId, {
            phase: extraction.partial ? 'partial' : 'parsed',
            processed_pages: extraction.processedPages,
            total_pages: extraction.totalPages,
            parsed_rows: extraction.rows,
          });

          if (extraction.partial) {
            safeFinishJob(
              jobId,
              'partial',
              'اكتمل جزء من المستند ويمكن استكماله لاحقًا من آخر صفحة محفوظة.',
              extraction.processedPages,
              extraction.totalPages,
              { file_name: file.name, extracted_rows: extraction.rows.length, resumable: true },
            );
          } else {
            safeUpdateJob(jobId, {
              status: 'ready',
              stage: 'جاهزة للاستيراد',
              message: 'اكتمل التحليل ويمكن بدء الاستيراد.',
              progress_current: extraction.processedPages,
              progress_total: extraction.totalPages,
              metadata: {
                file_name: file.name,
                extracted_rows: extraction.rows.length,
                resumable: resumeAvailableRef.current,
              },
            });
          }
          setStage('parsed');
        }
        return;
      }

      const { rows, headerError: hErr, usedAIMapping: aiUsed } = await parseWorkbookFile(file, fetchedAgents);
      if (hErr) {
        setHeaderError(hErr);
        setStage('idle');
        safeFinishJob(jobId, 'failed', hErr, 0, 0, { file_name: file.name });
      } else {
        setParsedRows(rows);
        setAiNotice(aiUsed ? 'لم يطابق الملف نموذج الاستيراد حرفياً، فتم استخدام الذكاء الاصطناعي لمطابقة الأعمدة تلقائياً. راجع الصفوف أدناه قبل الاستيراد.' : null);
        safeUpdateCheckpoint(jobId, {
          phase: 'parsed',
          parsed_rows: rows,
          processed_pages: 0,
          total_pages: 0,
        });
        safeUpdateJob(jobId, {
          status: 'ready',
          stage: 'جاهزة للاستيراد',
          message: `تم تحليل الملف والعثور على ${rows.length} صف للمراجعة.`,
          progress_current: rows.length,
          progress_total: rows.length,
          metadata: {
            file_name: file.name,
            rows: rows.length,
            ai_column_mapping: !!aiUsed,
            resumable: resumeAvailableRef.current,
          },
        });
        setStage('parsed');
      }
    } catch (err: unknown) {
      const message = friendlyError(err, 'تعذر قراءة الملف. تأكد أنه ملف صحيح غير تالف');
      setHeaderError(message);
      safeFinishJob(jobId, 'failed', message, 0, 0, { file_name: file.name });
    } finally {
      setParsing(false);
    }
  };

  const resumeFromCheckpoint = async (jobId: string) => {
    if (!user) return;

    setParsing(true);
    setHeaderError(null);
    setSummary(null);
    setRetryMode(false);

    try {
      const checkpoint = await getImportCheckpoint(jobId);
      if (!checkpoint) {
        throw new Error('تعذر العثور على نقطة الاستكمال لهذه المهمة. ربما تم تنظيفها بعد اكتمال الاستيراد.');
      }

      activeJobIdRef.current = jobId;
      activeBranchIdRef.current = checkpoint.branch_id;
      resumeAvailableRef.current = true;
      setFileName(checkpoint.file_name);
      setParsedRows(checkpoint.parsed_rows || []);
      setExcludedRows(new Set(checkpoint.excluded_rows || []));

      const fetchedAgents = await fetchImportAgents(user, checkpoint.branch_id);
      setAgents(fetchedAgents);

      const completed = await getCompletedImportRowNumbers(jobId).catch(() => new Set<number>());
      setProgress({
        done: completed.size,
        total: (checkpoint.parsed_rows || []).filter((row) => !(checkpoint.excluded_rows || []).includes(row.rowNumber)).length,
      });

      const canContinueDocument =
        (checkpoint.document_kind === 'pdf' || checkpoint.document_kind === 'image') &&
        checkpoint.total_pages > 0 &&
        checkpoint.processed_pages < checkpoint.total_pages &&
        checkpoint.processed_pages < 60 &&
        ['extracting', 'partial', 'failed'].includes(checkpoint.phase);

      if (canContinueDocument) {
        const sourceFile = await downloadCheckpointFile(checkpoint);
        const kind = checkpoint.document_kind as 'pdf' | 'image';

        safeUpdateJob(jobId, {
          status: 'running',
          stage: 'استكمال استخراج المستند',
          message: `استكمال من الصفحة ${checkpoint.processed_pages + 1} من ${checkpoint.total_pages}`,
          progress_current: checkpoint.processed_pages,
          progress_total: checkpoint.total_pages,
          metadata: {
            file_name: checkpoint.file_name,
            resumable: resumeAvailableRef.current,
            resumed: true,
          },
        });

        const extraction = await extractRowsFromDocument(
          sourceFile,
          kind,
          fetchedAgents,
          (nextProgress) => {
            setAiExtractionProgress(nextProgress);
            safeUpdateJob(jobId, {
              status: 'running',
              stage: 'استكمال استخراج الصفحات',
              progress_current: nextProgress.processedPages,
              progress_total: nextProgress.totalPages,
              message: `تم استخراج ${nextProgress.extractedRows} سجل حتى الآن`,
              metadata: {
                file_name: checkpoint.file_name,
                provider: nextProgress.provider ?? null,
                model: nextProgress.model ?? null,
                extracted_rows: nextProgress.extractedRows,
                resumable: resumeAvailableRef.current,
                resumed: true,
              },
            });
          },
          {
            startPage: checkpoint.processed_pages + 1,
            existingRows: checkpoint.parsed_rows || [],
            onCheckpoint: async (nextCheckpoint) => {
              try {
                await updateImportCheckpoint(jobId, {
                  phase: 'extracting',
                  processed_pages: nextCheckpoint.processedPages,
                  total_pages: nextCheckpoint.totalPages,
                  parsed_rows: nextCheckpoint.rows,
                });
              } catch (checkpointErr) {
                console.warn('Resume page checkpoint save failed:', checkpointErr);
              }
            },
          },
        );

        if (extraction.error) {
          setParsedRows(extraction.rows);
          setHeaderError(extraction.error);
          safeUpdateCheckpoint(jobId, {
            phase: 'failed',
            processed_pages: extraction.processedPages,
            total_pages: extraction.totalPages,
            parsed_rows: extraction.rows,
          });
          safeFinishJob(
            jobId,
            'failed',
            extraction.error,
            extraction.processedPages,
            extraction.totalPages,
            { file_name: checkpoint.file_name, resumable: resumeAvailableRef.current, resumed: true },
          );
          setStage(extraction.rows.length > 0 ? 'parsed' : 'idle');
          return;
        }

        setParsedRows(extraction.rows);
        safeUpdateCheckpoint(jobId, {
          phase: extraction.partial ? 'partial' : 'parsed',
          processed_pages: extraction.processedPages,
          total_pages: extraction.totalPages,
          parsed_rows: extraction.rows,
        });

        if (extraction.partial) {
          safeFinishJob(
            jobId,
            'partial',
            'توقف الاستكمال مؤقتًا بعد حفظ آخر صفحة مكتملة. يمكن المحاولة مرة أخرى لاحقًا.',
            extraction.processedPages,
            extraction.totalPages,
            { file_name: checkpoint.file_name, resumable: resumeAvailableRef.current, resumed: true },
          );
          setAiNotice(
            `تم استكمال الملف حتى الصفحة ${extraction.processedPages} من ${extraction.totalPages}. كل ما تم استخراجه محفوظ ويمكن استكمال الباقي لاحقًا.`
          );
        } else {
          safeUpdateJob(jobId, {
            status: 'ready',
            stage: 'جاهزة للاستيراد',
            message: 'اكتمل استخراج الملف بعد الاستكمال ويمكن بدء الاستيراد.',
            progress_current: extraction.processedPages,
            progress_total: extraction.totalPages,
            metadata: {
              file_name: checkpoint.file_name,
              extracted_rows: extraction.rows.length,
              resumable: resumeAvailableRef.current,
              resumed: true,
            },
          });
          setAiNotice(
            `تم استكمال استخراج الملف بنجاح من الصفحة ${checkpoint.processed_pages + 1} حتى النهاية. راجع الصفوف ثم ابدأ الاستيراد.`
          );
        }

        setStage('parsed');
        return;
      }

      setAiNotice(
        completed.size > 0
          ? `تم استعادة المهمة من آخر نقطة. ${completed.size} صف تم استيراده سابقًا ولن يُعاد إدخاله؛ اضغط استكمال الاستيراد للباقي.`
          : 'تم استعادة الملف والصفوف والتعديلات المحفوظة. يمكنك استكمال الاستيراد من نفس النقطة.'
      );
      safeUpdateJob(jobId, {
        status: 'ready',
        stage: completed.size > 0 ? 'جاهزة لاستكمال الاستيراد' : 'جاهزة للاستيراد',
        message: completed.size > 0
          ? `${completed.size} صف مكتمل مسبقًا وسيتم تخطيه تلقائيًا`
          : 'تمت استعادة المهمة من الـCheckpoint',
        progress_current: completed.size,
        progress_total: checkpoint.parsed_rows.length,
        metadata: {
          file_name: checkpoint.file_name,
          resumable: resumeAvailableRef.current,
          resumed: true,
        },
      });
      setStage('parsed');
    } catch (err) {
      setHeaderError(friendlyError(err, 'تعذر استعادة مهمة الاستيراد'));
      setStage('idle');
    } finally {
      setParsing(false);
      const next = new URLSearchParams(searchParams);
      next.delete('resume');
      setSearchParams(next, { replace: true });
    }
  };

  useEffect(() => {
    const resumeJobId = searchParams.get('resume');
    if (!user || !resumeJobId || resumeLoadedRef.current) return;
    resumeLoadedRef.current = true;
    void resumeFromCheckpoint(resumeJobId);
  }, [user, searchParams]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const startImport = async () => {
    const rowsToImport = parsedRows.filter((r) => !excludedRows.has(r.rowNumber));
    const jobId = activeJobIdRef.current;
    const branchId = activeBranchIdRef.current ?? currentBranchId;

    let completedRowNumbers = new Set<number>();
    let checkpointBeforeImport = null as Awaited<ReturnType<typeof getImportCheckpoint>>;
    if (jobId) {
      try {
        const [completedRows, checkpoint] = await Promise.all([
          getCompletedImportRowNumbers(jobId),
          getImportCheckpoint(jobId),
        ]);
        const currentRowNumbers = new Set(rowsToImport.map((row) => row.rowNumber));
        completedRowNumbers = new Set(
          [...completedRows].filter((rowNumber) => currentRowNumbers.has(rowNumber))
        );
        checkpointBeforeImport = checkpoint;
      } catch (checkpointErr) {
        console.warn('Import resume checkpoint read failed:', checkpointErr);
      }
    }

    const documentHasRemainingPages = !!checkpointBeforeImport
      && checkpointBeforeImport.document_kind !== 'spreadsheet'
      && checkpointBeforeImport.total_pages > 0
      && checkpointBeforeImport.processed_pages < checkpointBeforeImport.total_pages;

    setStage('importing');
    setProgress({ done: completedRowNumbers.size, total: rowsToImport.length });

    safeUpdateJob(jobId, {
      status: 'running',
      stage: 'استيراد الصفوف',
      message: completedRowNumbers.size > 0
        ? `استكمال الاستيراد من آخر نقطة — تم إنجاز ${completedRowNumbers.size} صف مسبقًا`
        : 'بدأ الاستيراد إلى قاعدة البيانات',
      progress_current: completedRowNumbers.size,
      progress_total: rowsToImport.length,
      metadata: {
        file_name: fileName,
        total_rows: rowsToImport.length,
        resumable: resumeAvailableRef.current,
      },
    });
    safeUpdateCheckpoint(jobId, {
      phase: 'importing',
      parsed_rows: parsedRows,
      excluded_rows: [...excludedRows],
      branch_id: branchId,
    });

    try {
      const result = await importRows(
        rowsToImport,
        branchId,
        (_r, done, total) => {
          setProgress({ done, total });
          safeUpdateJob(jobId, {
            progress_current: done,
            progress_total: total,
            stage: 'استيراد الصفوف',
            message: `تمت معالجة ${done} من ${total} صف`,
            metadata: {
              file_name: fileName,
              total_rows: total,
              resumable: resumeAvailableRef.current,
            },
          });
        },
        {
          jobId,
          completedRowNumbers,
        },
      );

      setSummary(result);

      if (result.failedCount > 0 || documentHasRemainingPages) {
        safeUpdateCheckpoint(jobId, {
          phase: 'partial',
          parsed_rows: parsedRows,
          excluded_rows: [...excludedRows],
        });
        safeFinishJob(
          jobId,
          'partial',
          result.failedCount > 0
            ? `تم استيراد ${result.importedCount} صف وفشل ${result.failedCount} صف. يمكنك استكمال الصفوف المتبقية لاحقًا.`
            : `تم استيراد الصفوف المستخرجة الحالية بنجاح، وما زال المستند يحتوي صفحات لم تُحلل. يمكن استكمالها لاحقًا من الصفحة ${(checkpointBeforeImport?.processed_pages || 0) + 1}.`,
          result.importedCount,
          result.totalRows,
          {
            file_name: fileName,
            imported_count: result.importedCount,
            failed_count: result.failedCount,
            remaining_document_pages: documentHasRemainingPages,
            resumable: resumeAvailableRef.current,
          },
        );
      } else {
        safeUpdateCheckpoint(jobId, {
          phase: 'completed',
          parsed_rows: parsedRows,
          excluded_rows: [...excludedRows],
        });
        safeFinishJob(
          jobId,
          'completed',
          `تم استيراد ${result.importedCount} صف بنجاح.`,
          result.totalRows,
          result.totalRows,
          {
            file_name: fileName,
            imported_count: result.importedCount,
            failed_count: 0,
            resumable: false,
          },
        );
        if (jobId) {
          void cleanupImportResumeData(jobId)
            .catch((cleanupErr) => console.warn('Import resume cleanup failed:', cleanupErr));
        }
      }

      setStage('done');
    } catch (err) {
      const message = friendlyError(err, 'تعذر إكمال الاستيراد');
      safeUpdateCheckpoint(jobId, {
        phase: 'partial',
        parsed_rows: parsedRows,
        excluded_rows: [...excludedRows],
      });
      safeFinishJob(
        jobId,
        'interrupted',
        message,
        progress.done,
        rowsToImport.length,
        { file_name: fileName, resumable: resumeAvailableRef.current },
      );
      setHeaderError(message);
      setStage('parsed');
    }
  };

  const retryFailedRows = () => {
    if (!summary) return;
    const failedRowNumbers = new Set(
      summary.results.filter((r) => r.status === 'error').map((r) => r.rowNumber)
    );
    const successfulRowNumbers = parsedRows
      .filter((r) => !failedRowNumbers.has(r.rowNumber))
      .map((r) => r.rowNumber);
    const nextExcluded = new Set(successfulRowNumbers);

    setExcludedRows(nextExcluded);
    safeUpdateCheckpoint(activeJobIdRef.current, {
      phase: 'parsed',
      parsed_rows: parsedRows,
      excluded_rows: [...nextExcluded],
    });
    setShowErrorsOnly(true);
    setRetryMode(true);
    setSummary(null);
    setStage('parsed');
  };

  const handleRowSaved = (updatedRow: ParsedRow) => {
    setParsedRows((prev) => {
      const next = prev.map((r) => (r.rowNumber === updatedRow.rowNumber ? updatedRow : r));
      safeUpdateCheckpoint(activeJobIdRef.current, { parsed_rows: next });
      return next;
    });
    setEditingRow(null);
  };

  const handleAgentQuickSelect = (row: ParsedRow, agentName: string) => {
    const updated = revalidateRow({
      ...row,
      raw: { ...row.raw, agent_name: agentName },
    }, agents);
    setParsedRows((prev) => {
      const next = prev.map((item) => item.rowNumber === row.rowNumber ? updated : item);
      safeUpdateCheckpoint(activeJobIdRef.current, { parsed_rows: next });
      return next;
    });
  };

  const toggleExcludeRow = (rowNumber: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      safeUpdateCheckpoint(activeJobIdRef.current, { excluded_rows: [...next] });
      return next;
    });
  };

  const visibleRows = showErrorsOnly ? parsedRows.filter((r) => r.payload === null) : parsedRows;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-xl font-bold text-secondary-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-primary-600" />
          استيراد البيانات
        </h2>
        <p className="text-sm text-secondary-500 mt-1">
          استيراد دفعة من العملاء والوثائق دفعة واحدة من ملف Excel أو CSV، أو من PDF/صورة بمساعدة الذكاء الاصطناعي. هذه الصفحة مستقلة ولا تؤثر على أي جزء آخر من النظام.
        </p>
      </div>

      {/* الخطوة 1: تحميل النموذج */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-secondary-900">١. حمّل نموذج Excel</h3>
            <p className="text-sm text-secondary-500 mt-1">
              يحتوي النموذج على كل الأعمدة المطلوبة، صف مثال، وورقة تعليمات بالقيم المسموحة لكل عمود.
            </p>
          </div>
          <button onClick={downloadTemplateFile} className="btn btn-secondary flex-shrink-0">
            <Download className="w-4 h-4" />
            تحميل النموذج
          </button>
        </div>
      </div>

      {/* الخطوة 2: رفع الملف */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-secondary-900">٢. اختر ملف Excel المُعبّأ</h3>

        {!fileName ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary-500 bg-primary-50' : 'border-secondary-300 hover:border-primary-400 hover:bg-secondary-50'
            )}
          >
            <UploadCloud className="w-10 h-10 text-secondary-400 mx-auto mb-3" />
            <p className="text-secondary-700 font-medium">اسحب ملف Excel أو CSV أو PDF أو صورة هنا أو اضغط للاختيار</p>
            <p className="text-xs text-secondary-400 mt-1">صيغة .xlsx، .xls، .csv، .pdf، .jpg، .png، .webp</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={onFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 bg-secondary-50 rounded-lg p-3 border border-secondary-200">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <span className="text-sm text-secondary-800 truncate">{fileName}</span>
            </div>
            {stage !== 'importing' && (
              <button onClick={resetAll} className="btn btn-ghost btn-sm flex-shrink-0" title="إزالة الملف">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {parsing && (
          <div className="space-y-2 rounded-lg border border-primary-100 bg-primary-50/50 p-3">
            <div className="flex items-center gap-2 text-sm text-secondary-700">
              <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              <span>
                {aiExtractionProgress?.totalPages
                  ? `جاري تحليل المستند... صفحة ${Math.min(aiExtractionProgress.processedPages + 1, aiExtractionProgress.totalPages)} من ${aiExtractionProgress.totalPages}`
                  : 'جاري قراءة وتحليل الملف...'}
              </span>
            </div>
            {aiExtractionProgress?.totalPages ? (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary-100">
                  <div
                    className="h-full bg-primary-600 transition-all duration-300"
                    style={{
                      width: `${(aiExtractionProgress.processedPages / aiExtractionProgress.totalPages) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-secondary-500">
                  تم استخراج {aiExtractionProgress.extractedRows} سجل حتى الآن
                  {aiExtractionProgress.provider ? ` · المزود الحالي: ${aiExtractionProgress.provider}` : ''}
                  {aiExtractionProgress.model ? ` · النموذج: ${aiExtractionProgress.model}` : ''}
                </p>
              </>
            ) : null}
          </div>
        )}

        {headerError && (
          <div className="flex items-start gap-2 bg-error-50 border border-error-200 text-error-700 rounded-lg p-3 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{headerError}</span>
          </div>
        )}

        {stage === 'parsed' && (
          <div className="space-y-4">
            {aiNotice && (
              <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg p-3 text-sm">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span>{aiNotice}</span>
              </div>
            )}
            {retryMode && (
              <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg p-3 text-sm">
                <RotateCcw className="w-4 h-4 flex-shrink-0" />
                <span>هذه إعادة محاولة للصفوف التي فشلت في المرة السابقة فقط. الصفوف التي نجحت سابقاً تم استيرادها بالفعل ولن تتكرر.</span>
              </div>
            )}
            <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold text-primary-700">DRY RUN — فحص قبل الاستيراد</p>
                  <p className="text-sm text-secondary-600 mt-1">
                    لم يتم حفظ أي بيانات بعد. راجع الملخص وصحّح الصفوف غير المؤكدة قبل البدء.
                  </p>
                </div>
                <span className="text-xs text-secondary-500">
                  {agents.length > 0 ? `${agents.length} وكيل متاح للمطابقة في نطاقك الحالي` : 'مطابقة الوكلاء ستُراجع على الخادم'}
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="rounded-lg bg-white border border-secondary-200 p-3">
                  <p className="text-xs text-secondary-500">إجمالي الصفوف</p>
                  <p className="text-xl font-bold text-secondary-900">{parsedRows.length}</p>
                </div>
                <div className="rounded-lg bg-white border border-success-200 p-3">
                  <p className="text-xs text-success-700">جاهز</p>
                  <p className="text-xl font-bold text-success-700">{validRowsCount}</p>
                </div>
                <div className="rounded-lg bg-white border border-error-200 p-3">
                  <p className="text-xs text-error-600">يحتاج تصحيح</p>
                  <p className="text-xl font-bold text-error-600">{invalidRowsCount}</p>
                </div>
                <div className="rounded-lg bg-white border border-warning-200 p-3">
                  <p className="text-xs text-warning-700">مشاكل وكيل</p>
                  <p className="text-xl font-bold text-warning-700">{agentIssueRowsCount}</p>
                </div>
                <div className="rounded-lg bg-white border border-warning-200 p-3">
                  <p className="text-xs text-warning-700">تكرار داخل الملف</p>
                  <p className="text-xl font-bold text-warning-700">{duplicateRowsCount}</p>
                </div>
              </div>
              {excludedCount > 0 && (
                <p className="text-xs text-secondary-500">{excludedCount} صف مستبعد يدويًا ولن يتم إرساله.</p>
              )}
              <div className="flex justify-end">
              <button
                onClick={startImport}
                disabled={validRowsCount === 0}
                className="btn btn-primary flex-shrink-0"
              >
                <PlayCircle className="w-4 h-4" />
                {progress.done > 0 ? 'استكمال الاستيراد' : 'بدء الاستيراد'}
              </button>
              </div>
            </div>

            {/* الخطوة ٢ب: معاينة وتعديل الصفوف قبل الإرسال — تصحيح خطأ بسيط
                (اسم وكيل، تاريخ، رقم) هنا بدل الرجوع للإكسل وإعادة الرفع */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-secondary-800 text-sm">معاينة الصفوف</h4>
                <label className="flex items-center gap-2 text-sm text-secondary-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showErrorsOnly}
                    onChange={(e) => setShowErrorsOnly(e.target.checked)}
                    className="rounded border-secondary-300"
                  />
                  عرض الصفوف التي بها أخطاء فقط
                </label>
              </div>

              <div className="overflow-x-auto border border-secondary-200 rounded-lg max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-secondary-200 text-secondary-500">
                      <th scope="col" className="text-right py-2 px-2">صف</th>
                      <th scope="col" className="text-right py-2 px-2">العميل</th>
                      <th scope="col" className="text-right py-2 px-2">الوكيل</th>
                      <th scope="col" className="text-right py-2 px-2">رقم الوثيقة</th>
                      <th scope="col" className="text-right py-2 px-2">الحالة</th>
                      <th scope="col" className="text-right py-2 px-2">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const isExcluded = excludedRows.has(row.rowNumber);
                      return (
                        <tr
                          key={row.rowNumber}
                          className={clsx(
                            'border-b border-secondary-100',
                            isExcluded && 'opacity-50'
                          )}
                        >
                          <td className="py-2 px-2 text-secondary-500">{row.rowNumber}</td>
                          <td className="py-2 px-2">{row.raw['customer_name'] || '-'}</td>
                          <td className="py-2 px-2 min-w-[180px]">
                            {!isExcluded && row.clientError?.includes('الوكيل') && agents.length > 0 ? (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) handleAgentQuickSelect(row, e.target.value);
                                }}
                                className="input-field py-1.5 text-xs min-w-[170px]"
                                aria-label={`اختيار الوكيل للصف ${row.rowNumber}`}
                              >
                                <option value="">اختر الوكيل الصحيح</option>
                                {agents.map((agent) => (
                                  <option key={agent.id} value={agent.name}>{agent.name}</option>
                                ))}
                              </select>
                            ) : (
                              row.raw['agent_name'] || '-'
                            )}
                          </td>
                          <td className="py-2 px-2">{row.raw['policy_number'] || '-'}</td>
                          <td className="py-2 px-2">
                            {isExcluded ? (
                              <span className="text-secondary-400">مستبعد</span>
                            ) : row.payload !== null ? (
                              <span className="inline-flex items-center gap-1 text-success-700">
                                <CheckCircle2 className="w-4 h-4" /> صحيح
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-error-600" title={row.clientError || ''}>
                                <XCircle className="w-4 h-4" /> {row.clientError}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingRow(row)}
                                className="btn btn-ghost btn-sm"
                                title="تعديل الصف"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleExcludeRow(row.rowNumber)}
                                className="btn btn-ghost btn-sm"
                                title={isExcluded ? 'إرجاع الصف للاستيراد' : 'استبعاد الصف من الاستيراد'}
                              >
                                {isExcluded ? <Undo2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {stage === 'importing' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-secondary-700">
              <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              جاري الاستيراد... ({progress.done} / {progress.total})
            </div>
            <div className="w-full h-2 bg-secondary-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-all duration-200"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* الخطوة 3: تقرير النتيجة */}
      {stage === 'done' && summary && (
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-secondary-900">٣. تقرير الاستيراد</h3>
            {summary.failedCount > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => exportErrorReport(summary)} className="btn btn-secondary btn-sm">
                  <FileDown className="w-4 h-4" />
                  تصدير تقرير الأخطاء
                </button>
                <button onClick={retryFailedRows} className="btn btn-primary btn-sm">
                  <RotateCcw className="w-4 h-4" />
                  إعادة محاولة الصفوف الفاشلة
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-success-200 bg-success-50 p-4 text-center">
              <p className="text-2xl font-bold text-success-700">{summary.importedCount}</p>
              <p className="text-sm text-success-700 mt-1">عميل ووثيقة تم استيرادهم</p>
            </div>
            <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-center">
              <p className="text-2xl font-bold text-error-600">{summary.failedCount}</p>
              <p className="text-sm text-error-600 mt-1">صف فشل استيراده</p>
            </div>
            <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4 text-center">
              <p className="text-2xl font-bold text-secondary-700">{summary.totalRows}</p>
              <p className="text-sm text-secondary-600 mt-1">إجمالي عدد الصفوف</p>
            </div>
          </div>

          {summary.failedCount > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200 text-secondary-500">
                    <th scope="col" className="text-right py-2 px-2">صف</th>
                    <th scope="col" className="text-right py-2 px-2">العميل</th>
                    <th scope="col" className="text-right py-2 px-2">رقم الوثيقة</th>
                    <th scope="col" className="text-right py-2 px-2">الحالة</th>
                    <th scope="col" className="text-right py-2 px-2">سبب الفشل</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.results.filter((r) => r.status === 'error').map((r) => (
                    <tr key={r.rowNumber} className="border-b border-secondary-100">
                      <td className="py-2 px-2 text-secondary-500">{r.rowNumber}</td>
                      <td className="py-2 px-2">{r.customerName || '-'}</td>
                      <td className="py-2 px-2">{r.policyNumber || '-'}</td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center gap-1 text-error-600">
                          <XCircle className="w-4 h-4" /> فشل
                        </span>
                      </td>
                      <td className="py-2 px-2 text-secondary-600">{r.errorMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary.importedCount > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-secondary-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-success-600" />
                عرض الصفوف التي تم استيرادها بنجاح ({summary.importedCount})
              </summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-secondary-200 text-secondary-500">
                      <th scope="col" className="text-right py-2 px-2">صف</th>
                      <th scope="col" className="text-right py-2 px-2">العميل</th>
                      <th scope="col" className="text-right py-2 px-2">رقم الوثيقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.results.filter((r) => r.status === 'success').map((r) => (
                      <tr key={r.rowNumber} className="border-b border-secondary-100">
                        <td className="py-2 px-2 text-secondary-500">{r.rowNumber}</td>
                        <td className="py-2 px-2">{r.customerName}</td>
                        <td className="py-2 px-2">{r.policyNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <button onClick={resetAll} className="btn btn-secondary">
            استيراد ملف آخر
          </button>
        </div>
      )}

      {editingRow && (
        <RowEditModal
          row={editingRow}
          agents={agents}
          onCancel={() => setEditingRow(null)}
          onSave={handleRowSaved}
        />
      )}
    </div>
  );
}
