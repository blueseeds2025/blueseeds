// ============================================================================
// 기본 항목 설정 섹션 (운영 설정 탭용)
// textbooks 테이블 사용 (진도 입력용)
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { BookOpen, FileText, Plus, Trash2, Loader2, Users, User, ClipboardList, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getTextbooks,
  createTextbook,
  updateTextbook,
  deleteTextbook,
  getExamTypes,
  createExamType,
  deleteExamType,
  type BasicSettings,
  type Textbook,
  type ExamType,
  type OperationMode,
} from '../actions/settings.actions';

interface BasicSettingsSectionProps {
  settings: BasicSettings;
  operationMode: OperationMode;
  isSaving: boolean;
  isSavingMode: boolean;
  onUpdateSetting: (key: keyof BasicSettings, value: boolean) => void;
  onUpdateOperationMode: (mode: OperationMode) => void;
}

export default function BasicSettingsSection({ 
  settings,
  operationMode,
  isSaving,
  isSavingMode,
  onUpdateSetting,
  onUpdateOperationMode,
}: BasicSettingsSectionProps) {
  // 교재 관련 상태
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [isLoadingTextbooks, setIsLoadingTextbooks] = useState(false);
  const [isTextbooksExpanded, setIsTextbooksExpanded] = useState(false);
  const [newTextbookTitle, setNewTextbookTitle] = useState('');
  const [newTextbookPages, setNewTextbookPages] = useState('');
  const [isAddingTextbook, setIsAddingTextbook] = useState(false);
  const [deletingTextbookId, setDeletingTextbookId] = useState<string | null>(null);
  
  // 교재 수정 상태
  const [editingTextbookId, setEditingTextbookId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingPages, setEditingPages] = useState('');
  const [isSavingTextbook, setIsSavingTextbook] = useState(false);

  // 시험 종류 관련 상태
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [isLoadingExamTypes, setIsLoadingExamTypes] = useState(false);
  const [isExamTypesExpanded, setIsExamTypesExpanded] = useState(false);
  const [newExamTypeName, setNewExamTypeName] = useState('');
  const [isAddingExamType, setIsAddingExamType] = useState(false);
  const [deletingExamTypeId, setDeletingExamTypeId] = useState<string | null>(null);

  // 진도 ON일 때 교재 목록 로드
  useEffect(() => {
    if (settings.progress_enabled) {
      loadTextbooks();
    }
  }, [settings.progress_enabled]);

  // 시험 점수 ON일 때 시험 종류 로드
  useEffect(() => {
    if (settings.exam_score_enabled) {
      loadExamTypes();
    }
  }, [settings.exam_score_enabled]);

  async function loadTextbooks() {
    setIsLoadingTextbooks(true);
    const result = await getTextbooks();
    if (result.ok) {
      setTextbooks(result.data);
    }
    setIsLoadingTextbooks(false);
  }

  async function loadExamTypes() {
    setIsLoadingExamTypes(true);
    const result = await getExamTypes();
    if (result.ok) {
      setExamTypes(result.data);
    }
    setIsLoadingExamTypes(false);
  }

  // 교재 추가
  async function handleAddTextbook() {
    if (!newTextbookTitle.trim()) return;
    
    setIsAddingTextbook(true);
    const totalPages = newTextbookPages ? parseInt(newTextbookPages, 10) : undefined;
    const result = await createTextbook(newTextbookTitle.trim(), totalPages);
    
    if (result.ok) {
      setTextbooks([...textbooks, result.data]);
      setNewTextbookTitle('');
      setNewTextbookPages('');
      toast.success('교재가 추가되었습니다');
    } else {
      toast.error(result.message);
    }
    setIsAddingTextbook(false);
  }

  // 교재 수정 시작
  function startEditTextbook(textbook: Textbook) {
    setEditingTextbookId(textbook.id);
    setEditingTitle(textbook.title);
    setEditingPages(textbook.total_pages?.toString() || '');
  }

  // 교재 수정 취소
  function cancelEditTextbook() {
    setEditingTextbookId(null);
    setEditingTitle('');
    setEditingPages('');
  }

  // 교재 수정 저장
  async function saveEditTextbook(textbookId: string) {
    if (!editingTitle.trim()) {
      toast.error('교재명을 입력해주세요');
      return;
    }
    
    setIsSavingTextbook(true);
    const totalPages = editingPages ? parseInt(editingPages, 10) : null;
    const result = await updateTextbook(textbookId, {
      title: editingTitle.trim(),
      total_pages: totalPages,
    });
    
    if (result.ok) {
      setTextbooks(textbooks.map(t => t.id === textbookId ? result.data : t));
      cancelEditTextbook();
      toast.success('교재가 수정되었습니다');
    } else {
      toast.error(result.message);
    }
    setIsSavingTextbook(false);
  }

  // 교재 삭제
  async function handleDeleteTextbook(id: string, title: string) {
    if (!confirm(`"${title}" 교재를 삭제할까요?\n\n⚠️ 이미 입력된 진도 기록은 유지됩니다.`)) return;
    
    setDeletingTextbookId(id);
    const result = await deleteTextbook(id);
    
    if (result.ok) {
      setTextbooks(textbooks.filter(t => t.id !== id));
      toast.success('교재가 삭제되었습니다');
    } else {
      toast.error(result.message);
    }
    setDeletingTextbookId(null);
  }

  // 시험 종류 추가
  async function handleAddExamType() {
    if (!newExamTypeName.trim()) return;
    
    setIsAddingExamType(true);
    const result = await createExamType(newExamTypeName.trim());
    
    if (result.ok) {
      setExamTypes([...examTypes, result.data]);
      setNewExamTypeName('');
      toast.success('시험 종류가 추가되었습니다');
    } else {
      toast.error(result.message);
    }
    setIsAddingExamType(false);
  }

  // 시험 종류 삭제
  async function handleDeleteExamType(id: string, name: string) {
    if (!confirm(`"${name}" 시험을 삭제할까요?\n\n⚠️ 이미 입력된 점수 데이터는 유지되지만, 더 이상 입력할 수 없게 됩니다.`)) return;
    
    setDeletingExamTypeId(id);
    const result = await deleteExamType(id);
    
    if (result.ok) {
      setExamTypes(examTypes.filter(e => e.id !== id));
      toast.success('시험 종류가 삭제되었습니다');
    } else {
      toast.error(result.message);
    }
    setDeletingExamTypeId(null);
  }

  function handleTextbookKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddTextbook();
    }
  }

  function handleExamTypeKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddExamType();
    }
  }

  return (
    <section className="bg-white rounded-xl border border-stone-200 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-stone-800">📝 기본 항목 설정</h2>
        <p className="text-sm text-stone-500 mt-1">
          피드 입력 시 표시할 기본 항목을 선택하세요
        </p>
      </div>
      
      <div className="space-y-3">
        {/* 운영 모드 선택 */}
        <div className="rounded-lg border border-stone-200 overflow-hidden">
          <div className="py-3 px-4 bg-stone-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <div className="font-medium text-stone-800">운영 모드</div>
                <div className="text-sm text-stone-500">피드 저장 방식 선택</div>
              </div>
            </div>
            
            {/* 모드 선택 버튼 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateOperationMode('solo')}
                disabled={isSavingMode}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  operationMode === 'solo'
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                } ${isSavingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <User className={`w-4 h-4 ${operationMode === 'solo' ? 'text-[#8B5CF6]' : 'text-stone-400'}`} />
                  <span className={`font-medium text-sm ${operationMode === 'solo' ? 'text-[#8B5CF6]' : 'text-stone-700'}`}>
                    담임형
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1 ml-6">
                  모든 항목 입력 필수
                </p>
              </button>
              
              <button
                type="button"
                onClick={() => onUpdateOperationMode('team')}
                disabled={isSavingMode}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  operationMode === 'team'
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/5'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                } ${isSavingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Users className={`w-4 h-4 ${operationMode === 'team' ? 'text-[#8B5CF6]' : 'text-stone-400'}`} />
                  <span className={`font-medium text-sm ${operationMode === 'team' ? 'text-[#8B5CF6]' : 'text-stone-700'}`}>
                    담임+보조
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1 ml-6">
                  일부만 저장 가능
                </p>
              </button>
            </div>
            
            {/* 저장 중 표시 */}
            {isSavingMode && (
              <div className="flex items-center gap-2 mt-2 text-xs text-stone-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                저장 중...
              </div>
            )}
          </div>
        </div>

        {/* 진도 입력 */}
        <div className="rounded-lg border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between py-3 px-4 bg-stone-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6366F1]/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#6366F1]" />
              </div>
              <div>
                <div className="font-medium text-stone-800">진도 입력</div>
                <div className="text-sm text-stone-500">학생별 학습 진도 기록</div>
              </div>
            </div>
            <Switch
              checked={settings.progress_enabled}
              onCheckedChange={(v) => onUpdateSetting('progress_enabled', v)}
              disabled={isSaving}
              className="data-[state=checked]:bg-[#6366F1]"
            />
          </div>
          
          {/* 진도 ON일 때 교재 목록 */}
          {settings.progress_enabled && (
            <div className="p-4 border-t border-stone-200 bg-white">
              {/* 헤더 - 클릭하면 펼치기/접기 */}
              <button
                onClick={() => setIsTextbooksExpanded(!isTextbooksExpanded)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">📚 사용 교재</span>
                  <span className="text-xs text-stone-400">({textbooks.length}개)</span>
                </div>
                <span className="text-xs text-[#6366F1] hover:underline">
                  {isTextbooksExpanded ? '접기 ▲' : '펼치기 ▼'}
                </span>
              </button>
              
              {/* 펼쳐진 상태 */}
              {isTextbooksExpanded && (
                <div className="mt-3">
                  {isLoadingTextbooks ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      불러오는 중...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* 교재 목록 (스크롤 영역) */}
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {textbooks.length === 0 ? (
                          <p className="text-sm text-stone-400 py-2">등록된 교재가 없습니다</p>
                        ) : (
                          textbooks.map((textbook) => (
                            <div
                              key={textbook.id}
                              className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg group"
                            >
                              {editingTextbookId === textbook.id ? (
                                // 수정 모드
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                                    placeholder="교재명"
                                  />
                                  <input
                                    type="number"
                                    value={editingPages}
                                    onChange={(e) => setEditingPages(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                                    placeholder="총 페이지"
                                  />
                                  <button
                                    onClick={() => saveEditTextbook(textbook.id)}
                                    disabled={isSavingTextbook}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  >
                                    {isSavingTextbook ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={cancelEditTextbook}
                                    className="p-1 text-stone-400 hover:bg-stone-100 rounded transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                // 보기 모드
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-stone-700">{textbook.title}</span>
                                    {textbook.total_pages && (
                                      <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                                        {textbook.total_pages}p
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => startEditTextbook(textbook)}
                                      className="p-1 text-stone-400 hover:text-[#6366F1] transition-colors"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTextbook(textbook.id, textbook.title)}
                                      disabled={deletingTextbookId === textbook.id}
                                      className="p-1 text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                    >
                                      {deletingTextbookId === textbook.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* 교재 추가 입력 */}
                      <div className="pt-2 border-t border-stone-100">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newTextbookTitle}
                            onChange={(e) => setNewTextbookTitle(e.target.value)}
                            onKeyDown={handleTextbookKeyDown}
                            placeholder="교재명"
                            className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
                            disabled={isAddingTextbook}
                          />
                          <input
                            type="number"
                            value={newTextbookPages}
                            onChange={(e) => setNewTextbookPages(e.target.value)}
                            onKeyDown={handleTextbookKeyDown}
                            placeholder="총 페이지"
                            className="w-24 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
                            disabled={isAddingTextbook}
                          />
                          <button
                            onClick={handleAddTextbook}
                            disabled={!newTextbookTitle.trim() || isAddingTextbook}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#6366F1] bg-[#6366F1]/10 rounded-lg hover:bg-[#6366F1]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isAddingTextbook ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                            추가
                          </button>
                        </div>
                        <p className="text-xs text-stone-400 mt-1.5">
                          💡 총 페이지를 입력하면 리포트에서 진행률을 계산할 수 있어요
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 시험 점수 */}
        <div className="rounded-lg border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between py-3 px-4 bg-stone-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EA580C]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#EA580C]" />
              </div>
              <div>
                <div className="font-medium text-stone-800">시험 점수</div>
                <div className="text-sm text-stone-500">시험/퀴즈 점수 입력</div>
              </div>
            </div>
            <Switch
              checked={settings.exam_score_enabled}
              onCheckedChange={(v) => onUpdateSetting('exam_score_enabled', v)}
              disabled={isSaving}
              className="data-[state=checked]:bg-[#EA580C]"
            />
          </div>

          {/* 시험 점수 ON일 때 시험 종류 목록 */}
          {settings.exam_score_enabled && (
            <div className="p-4 border-t border-stone-200 bg-white">
              {/* 헤더 - 클릭하면 펼치기/접기 */}
              <button
                onClick={() => setIsExamTypesExpanded(!isExamTypesExpanded)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">📝 시험 종류</span>
                  <span className="text-xs text-stone-400">({examTypes.length}개)</span>
                </div>
                <span className="text-xs text-[#EA580C] hover:underline">
                  {isExamTypesExpanded ? '접기 ▲' : '펼치기 ▼'}
                </span>
              </button>
              
              {/* 펼쳐진 상태 */}
              {isExamTypesExpanded && (
                <div className="mt-3">
                  {isLoadingExamTypes ? (
                    <div className="flex items-center gap-2 text-sm text-stone-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      불러오는 중...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* 시험 종류 목록 (스크롤 영역) */}
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {examTypes.length === 0 ? (
                          <p className="text-sm text-stone-400 py-2">등록된 시험이 없습니다</p>
                        ) : (
                          examTypes.map((examType) => (
                            <div
                              key={examType.id}
                              className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg group"
                            >
                              <div className="flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-[#EA580C]" />
                                <span className="text-sm text-stone-700">{examType.name}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteExamType(examType.id, examType.name)}
                                disabled={deletingExamTypeId === examType.id}
                                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all disabled:opacity-50"
                              >
                                {deletingExamTypeId === examType.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* 시험 종류 추가 입력 */}
                      <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                        <input
                          type="text"
                          value={newExamTypeName}
                          onChange={(e) => setNewExamTypeName(e.target.value)}
                          onKeyDown={handleExamTypeKeyDown}
                          placeholder="시험명 입력 (예: 단어 시험, 문법 퀴즈)"
                          className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
                          disabled={isAddingExamType}
                        />
                        <button
                          onClick={handleAddExamType}
                          disabled={!newExamTypeName.trim() || isAddingExamType}
                          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#EA580C] bg-[#EA580C]/10 rounded-lg hover:bg-[#EA580C]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isAddingExamType ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          추가
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* 저장 중 표시 */}
      {isSaving && (
        <div className="mt-3 text-center text-sm text-stone-500">
          저장 중...
        </div>
      )}
    </section>
  );
}
