'use client';

import { useState, useEffect } from 'react';
import { Search, Users, Phone, School, ChevronRight, Filter, MapPin, User, X } from 'lucide-react';

interface ClassInfo {
  id: string;
  name: string;
  color: string;
}

interface StudentInfo {
  id: string;
  name: string;
  phone: string | null;          // 보호자 연락처 (기존)
  parent_phone: string | null;   // 보호자 연락처 (새)
  student_phone: string | null;  // 학생 연락처
  school: string | null;
  grade: number | null;
  address: string | null;
  memo: string | null;
  is_active: boolean;
  class_id: string;
  class_name: string;
  class_color: string;
}

interface Props {
  initialClasses: ClassInfo[];
  isOwner: boolean;
}

// 학년 텍스트 변환
function gradeToText(grade: number | null): string {
  if (!grade) return '-';
  if (grade <= 6) return `초${grade}`;
  if (grade <= 9) return `중${grade - 6}`;
  return `고${grade - 9}`;
}

export default function TeacherStudentsClient({ initialClasses, isOwner }: Props) {
  const [classes] = useState<ClassInfo[]>(initialClasses);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);

  // 학생 목록 로드
  useEffect(() => {
    async function loadStudents() {
      setIsLoading(true);
      try {
        const res = await fetch('/dashboard/teacher/students/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classId: selectedClassId === 'all' ? null : selectedClassId }),
        });
        const data = await res.json();
        if (data.success) {
          setStudents(data.students);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (classes.length > 0) {
      loadStudents();
    } else {
      setIsLoading(false);
    }
  }, [selectedClassId, classes]);

  // 검색 필터링
  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.school?.toLowerCase().includes(query) ||
      s.phone?.includes(query)
    );
  });

  // 반별 그룹핑
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const key = student.class_id;
    if (!acc[key]) {
      acc[key] = {
        class_name: student.class_name,
        class_color: student.class_color,
        students: [],
      };
    }
    acc[key].students.push(student);
    return acc;
  }, {} as Record<string, { class_name: string; class_color: string; students: StudentInfo[] }>);

  if (classes.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-600 mb-2">담당 반이 없습니다</h2>
          <p className="text-sm text-gray-400">
            원장 선생님께 반 배정을 요청하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-[#E8E5E0] bg-white">
        <h1 className="text-xl font-bold text-[#37352F] mb-4">학생 목록</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 검색 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름, 학교, 연락처 검색..."
              className="w-full pl-10 pr-4 py-2 border border-[#E8E5E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
            />
          </div>
          
          {/* 반 필터 */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="pl-10 pr-8 py-2 border border-[#E8E5E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] appearance-none bg-white min-w-[140px]"
            >
              <option value="all">전체 반</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 학생 목록 */}
        <div className={`flex-1 overflow-y-auto p-4 ${selectedStudent ? 'hidden sm:block sm:w-1/2 lg:w-2/3' : ''}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery ? '검색 결과가 없습니다' : '학생이 없습니다'}
              </p>
            </div>
          ) : selectedClassId === 'all' ? (
            // 반별 그룹 표시
            <div className="space-y-6">
              {Object.entries(groupedStudents).map(([classId, group]) => (
                <div key={classId}>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.class_color }}
                    />
                    <h2 className="font-semibold text-[#37352F]">{group.class_name}</h2>
                    <span className="text-sm text-gray-400">({group.students.length}명)</span>
                  </div>
                  <div className="grid gap-2">
                    {group.students.map((student) => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        isSelected={selectedStudent?.id === student.id}
                        onClick={() => setSelectedStudent(student)}
                        showClass={false}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 단일 반 표시
            <div className="grid gap-2">
              {filteredStudents.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  isSelected={selectedStudent?.id === student.id}
                  onClick={() => setSelectedStudent(student)}
                  showClass={false}
                />
              ))}
            </div>
          )}
        </div>

        {/* 학생 상세 (모바일에선 전체, 데스크탑에선 오른쪽) */}
        {selectedStudent && (
          <div className="w-full sm:w-1/2 lg:w-1/3 border-l border-[#E8E5E0] bg-white overflow-y-auto">
            <StudentDetail 
              student={selectedStudent} 
              onClose={() => setSelectedStudent(null)} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

// 학생 행 컴포넌트
function StudentRow({ 
  student, 
  isSelected, 
  onClick,
  showClass = true,
}: { 
  student: StudentInfo; 
  isSelected: boolean;
  onClick: () => void;
  showClass?: boolean;
}) {
  return (
    <div
      className={`
        p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between
        ${isSelected 
          ? 'bg-[#EEF2FF] border-2 border-[#6366F1]' 
          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
        }
      `}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-[#37352F]">{student.name}</span>
          {showClass && (
            <span 
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ 
                backgroundColor: student.class_color + '20',
                color: student.class_color,
              }}
            >
              {student.class_name}
            </span>
          )}
          {!student.is_active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
              퇴원
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {student.school && <span>{student.school}</span>}
          {student.grade && <span>{gradeToText(student.grade)}</span>}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </div>
  );
}

// 학생 상세 컴포넌트 (원장용과 동일 디자인)
function StudentDetail({ 
  student, 
  onClose 
}: { 
  student: StudentInfo;
  onClose: () => void;
}) {
  const parentPhone = student.parent_phone || student.phone;
  
  return (
    <div className="bg-white rounded-lg border border-[#E8E5E0] h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-[#E8E5E0]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg text-[#37352F]">{student.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              student.is_active 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {student.is_active ? '재원' : '퇴원'}
            </span>
          </div>
          <button
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 기본 정보 */}
        <section>
          <h3 className="text-sm font-medium text-[#37352F] mb-3">기본 정보</h3>
          <div className="space-y-2">
            {/* 학교/학년 */}
            <div className="flex items-center gap-3 text-sm">
              <School className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {student.school || '-'} / {gradeToText(student.grade)}
              </span>
            </div>
            {/* 보호자 연락처 */}
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-400 text-xs mr-2">보호자</span>
                {parentPhone ? (
                  <a href={`tel:${parentPhone}`} className="text-[#6366F1] hover:underline">
                    {parentPhone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
            {/* 학생 연락처 */}
            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-400 text-xs mr-2">학생</span>
                {student.student_phone ? (
                  <a href={`tel:${student.student_phone}`} className="text-[#6366F1] hover:underline">
                    {student.student_phone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
            {/* 주소 */}
            {student.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{student.address}</span>
              </div>
            )}
          </div>
        </section>

        {/* 학생 특이사항 */}
        {student.memo && (
          <section>
            <h3 className="text-sm font-medium text-[#37352F] mb-2">학생 특이사항</h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{student.memo}</p>
            </div>
          </section>
        )}

        {/* 수강 반 */}
        <section>
          <h3 className="text-sm font-medium text-[#37352F] mb-3">수강 반</h3>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: student.class_color }}
            />
            <span className="text-sm font-medium text-[#37352F]">
              {student.class_name}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}