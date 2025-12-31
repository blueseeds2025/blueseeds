'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { WeeklyReportData, MessageTone, ReportStyleTemplate } from '@/types/report';
import { 
  getReportSettings, 
  getClassesForReport, 
  getStudentsForReport,
  generateBulkWeeklyReports,
} from '../actions/report.actions';
import { getDateRange, TOAST_MESSAGES } from '../constants';

interface ReportSettings {
  strengthThreshold: number;
  weaknessThreshold: number;
  messageTone: MessageTone;
}

interface ClassInfo {
  id: string;
  name: string;
}

interface StudentInfo {
  id: string;
  name: string;
  display_code: string | null;
}

interface UseReportGenerationOptions {
  /** teacher인 경우 담당 반이 1개면 자동 선택 */
  autoSelectSingleClass?: boolean;
}

interface UseReportGenerationReturn {
  // 설정
  settings: ReportSettings;
  styleTemplate: ReportStyleTemplate;
  setStyleTemplate: (template: ReportStyleTemplate) => void;
  
  // 데이터
  classes: ClassInfo[];
  students: StudentInfo[];
  
  // 선택 상태
  selectedClassId: string | null;
  setSelectedClassId: (classId: string | null) => void;
  selectedStudentIds: string[];
  setSelectedStudentIds: (ids: string[]) => void;
  startDate: string;
  endDate: string;
  handleDateChange: (start: string, end: string) => void;
  
  // 리포트
  reports: WeeklyReportData[];
  setReports: React.Dispatch<React.SetStateAction<WeeklyReportData[]>>;
  
  // 상태
  isLoading: boolean;
  isLoadingStudents: boolean;
  isGenerating: boolean;
  
  // 액션
  handleGenerateReports: () => Promise<void>;
  handleCloseReport: (studentId: string) => void;
}

/**
 * 리포트 생성 공통 훅
 */
export function useReportGeneration(
  options: UseReportGenerationOptions = {}
): UseReportGenerationReturn {
  const { autoSelectSingleClass = false } = options;
  
  // 설정 상태
  const [settings, setSettings] = useState<ReportSettings>({
    strengthThreshold: 80,
    weaknessThreshold: 75,
    messageTone: 'friendly',
  });
  const [styleTemplate, setStyleTemplate] = useState<ReportStyleTemplate>('simple');
  
  // 데이터 상태
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  
  // 선택 상태
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 리포트 상태
  const [reports, setReports] = useState<WeeklyReportData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 로딩 상태
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  
  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 설정 로드
        const settingsResult = await getReportSettings();
        if (settingsResult.ok) {
          setSettings({
            strengthThreshold: settingsResult.data.strength_threshold,
            weaknessThreshold: settingsResult.data.weakness_threshold,
            messageTone: settingsResult.data.messageTone,
          });
        }
        setIsLoadingSettings(false);
        
        // 반 목록 로드
        const classesResult = await getClassesForReport();
        if (classesResult.ok) {
          setClasses(classesResult.data);
          
          // 담당 반이 하나면 자동 선택 (옵션)
          if (autoSelectSingleClass && classesResult.data.length === 1) {
            setSelectedClassId(classesResult.data[0].id);
          }
        }
        setIsLoadingClasses(false);
        
        // 기본 기간 설정 (최근 2주)
        const { startDate: defaultStart, endDate: defaultEnd } = getDateRange('2weeks');
        setStartDate(defaultStart);
        setEndDate(defaultEnd);
      } catch (error) {
        console.error('loadInitialData error:', error);
        setIsLoadingSettings(false);
        setIsLoadingClasses(false);
      }
    };
    
    loadInitialData();
  }, [autoSelectSingleClass]);
  
  // 반 선택 시 학생 로드
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    
    const loadStudents = async () => {
      setIsLoadingStudents(true);
      const result = await getStudentsForReport(selectedClassId);
      if (result.ok) {
        setStudents(result.data);
      }
      setIsLoadingStudents(false);
    };
    
    loadStudents();
  }, [selectedClassId]);
  
  // 기간 변경 핸들러
  const handleDateChange = useCallback((newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
  }, []);
  
  // 리포트 생성
  const handleGenerateReports = useCallback(async () => {
    if (selectedStudentIds.length === 0) {
      toast.error(TOAST_MESSAGES.NO_STUDENT_SELECTED);
      return;
    }
    
    if (!startDate || !endDate) {
      toast.error(TOAST_MESSAGES.NO_DATE_SELECTED);
      return;
    }
    
    setIsGenerating(true);
    setReports([]);
    
    const result = await generateBulkWeeklyReports({
      studentIds: selectedStudentIds,
      startDate,
      endDate,
    });
    
    setIsGenerating(false);
    
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    
    const { reports: newReports, errorCount, hasConfigChanges } = result.data;
    
    setReports(newReports || []);
    
    if (newReports.length > 0) {
      toast.success(`${newReports.length}명의 리포트가 생성되었습니다`);
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount}명은 데이터가 없어 생성되지 않았습니다`);
    }
    
    // 항목 변경 경고
    if (hasConfigChanges) {
      toast.warning(
        '선택한 기간에 평가항목이 변경되었습니다. 리포트 미리보기에서 변경 시점을 확인하세요.',
        { duration: 6000 }
      );
    }
  }, [selectedStudentIds, startDate, endDate]);
  
  // 개별 리포트 닫기
  const handleCloseReport = useCallback((studentId: string) => {
    setReports(prev => prev.filter(r => r.student.id !== studentId));
  }, []);
  
  const isLoading = isLoadingSettings || isLoadingClasses;
  
  return {
    // 설정
    settings,
    styleTemplate,
    setStyleTemplate,
    
    // 데이터
    classes,
    students,
    
    // 선택 상태
    selectedClassId,
    setSelectedClassId,
    selectedStudentIds,
    setSelectedStudentIds,
    startDate,
    endDate,
    handleDateChange,
    
    // 리포트
    reports,
    setReports,
    
    // 상태
    isLoading,
    isLoadingStudents,
    isGenerating,
    
    // 액션
    handleGenerateReports,
    handleCloseReport,
  };
}