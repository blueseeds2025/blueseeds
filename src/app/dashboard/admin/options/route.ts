import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// 옵션 저장 API
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const { setId, label, score } = body;

    // 1. 세트 정보 조회
    const { data: optionSet } = await supabase
      .from('feed_option_sets')
      .select('is_scored, score_step')
      .eq('id', setId)
      .single();

    if (!optionSet) {
      return NextResponse.json(
        { error: 'Option set not found' },
        { status: 404 }
      );
    }

    // 2. 점수 검증
    let finalScore = score;
    
    if (optionSet.is_scored) {
      // 점수형: 점수 필수
      if (!score && score !== 0) {
        return NextResponse.json(
          { error: '점수형 세트는 점수가 필수입니다' },
          { status: 400 }
        );
      }
      
      // score_step 검증 (있을 경우)
      if (optionSet.score_step) {
        const remainder = score % optionSet.score_step;
        if (remainder !== 0) {
          // 자동 보정
          finalScore = Math.round(score / optionSet.score_step) * optionSet.score_step;
          console.log(`Score auto-corrected: ${score} → ${finalScore}`);
        }
      }
    } else {
      // 문장형: 점수 강제 NULL
      finalScore = null;
    }

    // 3. 현재 최대 순서 조회
    const { data: maxOrderData } = await supabase
      .from('feed_options')
      .select('display_order')
      .eq('set_id', setId)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = maxOrderData?.[0]?.display_order ?? -1;

    // 4. 옵션 저장
    const { data, error } = await supabase
      .from('feed_options')
      .insert({
        set_id: setId,
        label,
        score: finalScore,
        display_order: maxOrder + 1
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      data,
      corrected: score !== finalScore ? { original: score, corrected: finalScore } : null
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// 세트 교체 API (트랜잭션)
export async function PUT(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const { oldSetId, newSetData } = body;

    // 트랜잭션으로 처리
    const { error: deactivateError } = await supabase
      .from('feed_option_sets')
      .update({ is_active: false })
      .eq('id', oldSetId);

    if (deactivateError) throw deactivateError;

    // 새 세트 생성
    const { data: newSet, error: createError } = await supabase
      .from('feed_option_sets')
      .insert(newSetData)
      .select()
      .single();

    if (createError) {
      // 롤백: 기존 세트 다시 활성화
      await supabase
        .from('feed_option_sets')
        .update({ is_active: true })
        .eq('id', oldSetId);
      
      throw createError;
    }

    return NextResponse.json({ data: newSet });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// is_scored 변경 시도 차단
export async function PATCH(request: Request) {
  return NextResponse.json(
    { error: '평가 방식은 변경할 수 없습니다. 새 세트를 만들어주세요.' },
    { status: 422 }
  );
}