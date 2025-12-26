'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/lib/database.types';

interface OptionSet {
  id: string;
  name: string;
  category: string;
  is_scored: boolean;
  score_step: number | null;
  is_active: boolean;
}

interface Option {
  id: string;
  set_id: string;
  label: string;
  score: number | null;
  display_order: number;
  is_active: boolean;
}

interface FeedValue {
  set_id: string;
  option_id: string | null;
}

export default function FeedsPage() {
  // 기본 상태
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [todayFeeds, setTodayFeeds] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'saved'>('draft');
  const [currentFeedId, setCurrentFeedId] = useState<string | null>(null);
  
  // 피드 옵션 시스템
  const [optionSets, setOptionSets] = useState<OptionSet[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [feedValues, setFeedValues] = useState<Record<string, FeedValue>>({});
  
  // 기본 필드들
  const [basicData, setBasicData] = useState({
    progress_main: '',
    progress_vocab: '',
    flag_absence: '-',
    special_main: ''
  });

  const autoSaveTimer = useRef<NodeJS.Timeout>();
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadStudents();
    loadOptionSets();
    loadTodayFeeds();
  }, []);

  // 자동 임시저장
  useEffect(() => {
    if (selectedStudent && saveStatus === 'draft') {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      
      autoSaveTimer.current = setTimeout(() => {
        const draftData = {
          student: selectedStudent,
          basicData,
          feedValues
        };
        localStorage.setItem(`draft_${selectedStudent}`, JSON.stringify(draftData));
        toast.success('임시저장됨', { duration: 1000 });
      }, 2000);
    }
    
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [basicData, feedValues, selectedStudent, saveStatus]);

  // 학생 목록 로드
  const loadStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .is('deleted_at', null)
      .order('name');
    
    if (data) setStudents(data);
  };

  // 활성화된 옵션 세트만 로드
  const loadOptionSets = async () => {
    const { data: sets } = await supabase
      .from('feed_option_sets')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (sets) {
      setOptionSets(sets);
      
      // 각 세트의 활성 옵션들 로드
      for (const set of sets) {
        const { data: opts } = await supabase
          .from('feed_options')
          .select('*')
          .eq('set_id', set.id)
          .eq('is_active', true)
          .order('display_order');
        
        if (opts) {
          setOptions(prev => ({ ...prev, [set.id]: opts }));
        }
      }
      
      // 초기 feedValues 구조 생성
      const initialFeedValues: Record<string, FeedValue> = {};
      sets.forEach(set => {
        initialFeedValues[set.id] = {
          set_id: set.id,
          option_id: null
        };
      });
      setFeedValues(initialFeedValues);
    }
  };

  // 오늘 작성한 피드 로드
  const loadTodayFeeds = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('feeds')
      .select('*, students(name)')
      .eq('teacher_id', user?.id)
      .eq('date', today)
      .is('deleted_at', null);
    
    if (data) setTodayFeeds(data);
  };

  // 필터링된 학생 목록
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // 학생 선택 처리
  const handleStudentSelect = async (student: any) => {
    setSelectedStudent(student.id);
    setStudentSearch(student.name);
    setShowStudentDropdown(false);
    
    // 기존 피드 확인
    const existingFeed = todayFeeds.find(f => f.student_id === student.id);
    if (existingFeed) {
      setCurrentFeedId(existingFeed.id);
      
      // 기본 데이터 로드
      setBasicData({
        progress_main: existingFeed.progress_main || '',
        progress_vocab: existingFeed.progress_vocab || '',
        flag_absence: existingFeed.flag_absence || '-',
        special_main: existingFeed.special_main || ''
      });
      
      // 피드 값들 로드
      const { data: values } = await supabase
        .from('feed_values')
        .select('*')
        .eq('feed_id', existingFeed.id);
      
      if (values) {
        const loadedValues: Record<string, FeedValue> = {};
        values.forEach(v => {
          loadedValues[v.set_id] = {
            set_id: v.set_id,
            option_id: v.option_id
          };
        });
        
        // 없는 세트는 초기값으로 채우기
        optionSets.forEach(set => {
          if (!loadedValues[set.id]) {
            loadedValues[set.id] = {
              set_id: set.id,
              option_id: null
            };
          }
        });
        
        setFeedValues(loadedValues);
      }
      
      setSaveStatus('saved');
      localStorage.removeItem(`draft_${student.id}`);
    } else {
      setCurrentFeedId(null);
      
      // 임시저장 확인
      const draft = localStorage.getItem(`draft_${student.id}`);
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          setBasicData(draftData.basicData);
          setFeedValues(draftData.feedValues);
          toast.info('임시저장된 내용을 불러왔습니다');
        } catch (e) {
          console.error('Draft load error:', e);
        }
      } else {
        // 초기화
        setBasicData({
          progress_main: '',
          progress_vocab: '',
          flag_absence: '-',
          special_main: ''
        });
        
        const initialFeedValues: Record<string, FeedValue> = {};
        optionSets.forEach(set => {
          initialFeedValues[set.id] = {
            set_id: set.id,
            option_id: null
          };
        });
        setFeedValues(initialFeedValues);
      }
      setSaveStatus('draft');
    }
  };

  // 옵션 변경
  const handleOptionChange = (setId: string, optionId: string) => {
    setFeedValues(prev => ({
      ...prev,
      [setId]: { set_id: setId, option_id: optionId || null }
    }));
    setSaveStatus('draft');
  };

  // 기본 필드 변경
  const handleBasicChange = (field: string, value: any) => {
    setBasicData(prev => ({ ...prev, [field]: value }));
    setSaveStatus('draft');
  };

  // 저장 처리
  const handleSave = async () => {
    if (!selectedStudent) {
      toast.error('학생을 선택해주세요');
      return;
    }

    setIsSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user?.id)
      .single();

    const today = new Date().toISOString().split('T')[0];

    // 기본 피드 데이터
    const feedPayload = {
      tenant_id: profile?.tenant_id,
      student_id: selectedStudent,
      teacher_id: user?.id,
      date: today,
      status: 'saved',
      ...basicData
    };

    let feedId = currentFeedId;
    
    if (currentFeedId) {
      // 업데이트
      const { error } = await supabase
        .from('feeds')
        .update(feedPayload)
        .eq('id', currentFeedId);

      if (error) {
        toast.error('저장 중 오류가 발생했습니다');
        setIsSaving(false);
        return;
      }
    } else {
      // 새로 생성
      const { data: newFeed, error } = await supabase
        .from('feeds')
        .insert(feedPayload)
        .select()
        .single();

      if (error || !newFeed) {
        toast.error('저장 중 오류가 발생했습니다');
        setIsSaving(false);
        return;
      }
      
      feedId = newFeed.id;
      setCurrentFeedId(feedId);
    }

    // 기존 피드 값 삭제
    await supabase
      .from('feed_values')
      .delete()
      .eq('feed_id', feedId);

    // 새 피드 값 저장
    const valuesToInsert = Object.values(feedValues)
      .filter(v => v.option_id)
      .map(v => ({
        feed_id: feedId,
        set_id: v.set_id,
        option_id: v.option_id
      }));

    if (valuesToInsert.length > 0) {
      await supabase
        .from('feed_values')
        .insert(valuesToInsert);
    }

    setSaveStatus('saved');
    localStorage.removeItem(`draft_${selectedStudent}`);
    toast.success('피드가 저장되었습니다');
    await loadTodayFeeds();
    
    setIsSaving(false);
  };

  // 수정 처리
  const handleEdit = async (feed: any) => {
    const student = students.find(s => s.id === feed.student_id);
    if (student) {
      await handleStudentSelect(student);
    }
  };

  // 삭제 처리
  const handleDelete = async (feedId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('feeds')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', feedId);

    if (!error) {
      await loadTodayFeeds();
      toast.success('삭제되었습니다', {
        action: {
          label: '실행취소',
          onClick: async () => {
            await supabase
              .from('feeds')
              .update({ deleted_at: null })
              .eq('id', feedId);
            await loadTodayFeeds();
            toast.success('복구되었습니다');
          }
        }
      });
    }
  };

  // 초기화
  const handleReset = () => {
    setSelectedStudent('');
    setStudentSearch('');
    setCurrentFeedId(null);
    setBasicData({
      progress_main: '',
      progress_vocab: '',
      flag_absence: '-',
      special_main: ''
    });
    
    const resetFeedValues: Record<string, FeedValue> = {};
    optionSets.forEach(set => {
      resetFeedValues[set.id] = {
        set_id: set.id,
        option_id: null
      };
    });
    setFeedValues(resetFeedValues);
    setSaveStatus('draft');
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">피드 입력</h1>
      
      <div className="mb-6 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium">
          오늘 진행 상황: <span className="text-blue-600">{todayFeeds.length}/{students.length}명 완료</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>오늘의 피드 작성</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 학생 선택 */}
          <div className="mb-4 relative">
            <label className="block text-sm font-medium mb-2">학생 선택</label>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setShowStudentDropdown(true);
              }}
              onFocus={() => setShowStudentDropdown(true)}
              onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
              placeholder="학생 이름을 입력하세요"
              className="w-full p-2 border rounded"
            />
            {showStudentDropdown && filteredStudents.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredStudents.map((student) => {
                  const isCompleted = todayFeeds.some(f => f.student_id === student.id);
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleStudentSelect(student)}
                      className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                    >
                      <span>{student.name}</span>
                      {isCompleted && <span className="text-green-500">✅</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedStudent && (
            <>
              {/* 상태 표시 */}
              <div className={`mb-4 p-2 rounded text-center text-sm font-medium ${
                saveStatus === 'draft' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {saveStatus === 'draft' ? '작성 중' : '저장 완료'}
              </div>

              {/* 기본 필드 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">학습진도</label>
                  <input
                    value={basicData.progress_main}
                    onChange={(e) => handleBasicChange('progress_main', e.target.value)}
                    className="w-full p-2 border rounded"
                    placeholder="예: ORT 3-5"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">학습진도(단어)</label>
                  <input
                    value={basicData.progress_vocab}
                    onChange={(e) => handleBasicChange('progress_vocab', e.target.value)}
                    className="w-full p-2 border rounded"
                    placeholder="예: Sight Words 2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">등/결석</label>
                  <select 
                    value={basicData.flag_absence}
                    onChange={(e) => handleBasicChange('flag_absence', e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="-">등원</option>
                    <option value="결석">결석</option>
                    <option value="병결">병결</option>
                    <option value="개인사유">개인사유</option>
                  </select>
                </div>
              </div>

              {/* 피드 옵션들 (모두 드롭다운) */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-gray-700 border-b pb-1">평가 항목</h3>
                {optionSets.map(set => (
                  <div key={set.id} className="grid grid-cols-2 gap-4 items-center">
                    <label className="text-sm font-medium">
                      {set.name}
                      <span className="ml-1 text-xs text-gray-500">
                        {set.is_scored ? '(점수)' : '(선택)'}
                      </span>
                    </label>
                    
                    <select
                      value={feedValues[set.id]?.option_id || ''}
                      onChange={(e) => handleOptionChange(set.id, e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">선택하세요</option>
                      {options[set.id]?.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                          {set.is_scored && opt.score !== null && ` (${opt.score}점)`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* 특이사항 */}
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">특이사항</label>
                <textarea
                  value={basicData.special_main}
                  onChange={(e) => handleBasicChange('special_main', e.target.value)}
                  className="w-full p-2 border rounded h-20"
                  placeholder="특이사항이 있으면 입력하세요"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  <Save size={16} />
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleReset}
                  className="flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  초기화
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 오늘 작성한 피드 목록 */}
      {todayFeeds.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>오늘 작성한 피드</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayFeeds.map((feed) => (
                <div key={feed.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold">{feed.students?.name}</span>
                      <div className="text-sm text-gray-600 mt-1">
                        진도: {feed.progress_main || '-'} | 
                        등원: {feed.flag_absence === '-' ? '⭕' : '❌'}
                        {feed.special_main && ` | ${feed.special_main.substring(0, 30)}...`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleEdit(feed)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDelete(feed.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
  } 