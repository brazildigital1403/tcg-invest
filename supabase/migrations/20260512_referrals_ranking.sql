-- ═══════════════════════════════════════════════════════════════════════════
-- INDIQUE E GANHE — Migration Sprint 2
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adiciona 2 RPCs novas (não toca em nada da Sprint 1):
--   • get_ranking(p_year, p_month)         → top 20 + my position
--   • snapshot_monthly_ranking(p_year, p_month) → cria snapshot mensal
--
-- IDEMPOTENTE: pode rodar várias vezes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── RPC: get_ranking ────────────────────────────────────────────────────────
-- Retorna top 20 do período + a posição do user logado (mesmo fora do top).
-- Período: ano + mês (NULL = mês corrente).
-- Tiebreaker: quem ativou primeiro (MIN ativou_at) vence.

CREATE OR REPLACE FUNCTION public.get_ranking(
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_month integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_top jsonb;
  v_my_position int;
  v_my_qualified int;
  v_user_id uuid := auth.uid();
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM now())::int);
  v_month := COALESCE(p_month, EXTRACT(MONTH FROM now())::int);

  v_period_start := make_timestamptz(v_year, v_month, 1, 0, 0, 0, 'UTC');
  v_period_end := v_period_start + interval '1 month';

  -- Se o período já passou, busca do snapshot (histórico imutável)
  IF v_period_end < now() THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'position', s.position,
        'user_id', s.user_id,
        'username', COALESCE(u.username, 'colecionador'),
        'qualified_count', s.qualified_referrals_count,
        'prize_awarded', s.prize_awarded
      ) ORDER BY s.position
    ) INTO v_top
    FROM monthly_ranking_snapshots s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.period_year = v_year AND s.period_month = v_month
    LIMIT 20;

    -- Posição do user logado neste snapshot
    SELECT position, qualified_referrals_count
    INTO v_my_position, v_my_qualified
    FROM monthly_ranking_snapshots
    WHERE period_year = v_year AND period_month = v_month AND user_id = v_user_id;

  ELSE
    -- Período corrente: calcula em tempo real
    WITH ranked AS (
      SELECT
        r.referrer_user_id AS user_id,
        COUNT(*) FILTER (
          WHERE r.status IN ('ativou', 'engajado')
          AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
          AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
        ) AS qualified_count,
        MIN(COALESCE(r.engajou_at, r.ativou_at)) FILTER (
          WHERE r.status IN ('ativou', 'engajado')
          AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
          AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
        ) AS first_qualified_at
      FROM referrals r
      GROUP BY r.referrer_user_id
      HAVING COUNT(*) FILTER (
        WHERE r.status IN ('ativou', 'engajado')
        AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
        AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
      ) > 0
    ),
    positioned AS (
      SELECT
        user_id,
        qualified_count,
        first_qualified_at,
        ROW_NUMBER() OVER (ORDER BY qualified_count DESC, first_qualified_at ASC) AS position
      FROM ranked
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'position', p.position,
        'user_id', p.user_id,
        'username', COALESCE(u.username, 'colecionador'),
        'qualified_count', p.qualified_count
      ) ORDER BY p.position
    ) INTO v_top
    FROM positioned p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.position <= 20;

    -- Posição do user logado mesmo fora do top 20
    SELECT position, qualified_count INTO v_my_position, v_my_qualified
    FROM (
      SELECT
        user_id,
        qualified_count,
        ROW_NUMBER() OVER (ORDER BY qualified_count DESC, first_qualified_at ASC) AS position
      FROM (
        SELECT
          r.referrer_user_id AS user_id,
          COUNT(*) FILTER (
            WHERE r.status IN ('ativou', 'engajado')
            AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
            AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
          ) AS qualified_count,
          MIN(COALESCE(r.engajou_at, r.ativou_at)) FILTER (
            WHERE r.status IN ('ativou', 'engajado')
            AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
            AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
          ) AS first_qualified_at
        FROM referrals r
        GROUP BY r.referrer_user_id
        HAVING COUNT(*) FILTER (
          WHERE r.status IN ('ativou', 'engajado')
          AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
          AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
        ) > 0
      ) inner_ranked
    ) ranked_all
    WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'year', v_year,
    'month', v_month,
    'is_historical', v_period_end < now(),
    'top', COALESCE(v_top, '[]'::jsonb),
    'my_position', v_my_position,
    'my_qualified_count', COALESCE(v_my_qualified, 0)
  );
END;
$$;

-- ── RPC: snapshot_monthly_ranking ──────────────────────────────────────────
-- Cria snapshot imutável do ranking do período + marca prizes Top 3.
-- Chamado pelo cron mensal (dia 1 de cada mês, 00:05 UTC).
-- IDEMPOTENTE: se snapshot do período já existe, não duplica.
-- Tiebreaker: quem ativou primeiro vence (MIN ativou_at do período).

CREATE OR REPLACE FUNCTION public.snapshot_monthly_ranking(
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_inserted_count int := 0;
  v_existing_count int;
  v_top3 jsonb;
BEGIN
  IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end := v_period_start + interval '1 month';

  -- Já existe snapshot pra este período?
  SELECT count(*) INTO v_existing_count
  FROM monthly_ranking_snapshots
  WHERE period_year = p_year AND period_month = p_month;

  IF v_existing_count > 0 THEN
    -- Retorna o top 3 atual pra cron continuar (idempotente)
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', user_id,
      'position', position,
      'qualified_count', qualified_referrals_count,
      'prize_awarded', prize_awarded
    ) ORDER BY position)
    INTO v_top3
    FROM monthly_ranking_snapshots
    WHERE period_year = p_year AND period_month = p_month AND position <= 3;

    RETURN jsonb_build_object(
      'ok', true,
      'noop', true,
      'reason', 'snapshot_exists',
      'existing_count', v_existing_count,
      'top3', COALESCE(v_top3, '[]'::jsonb)
    );
  END IF;

  -- Insere snapshot do top do mês
  WITH ranked AS (
    SELECT
      r.referrer_user_id AS user_id,
      COUNT(*) FILTER (
        WHERE r.status IN ('ativou', 'engajado')
        AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
        AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
      ) AS qualified_count,
      MIN(COALESCE(r.engajou_at, r.ativou_at)) FILTER (
        WHERE r.status IN ('ativou', 'engajado')
        AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
        AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
      ) AS first_qualified_at
    FROM referrals r
    GROUP BY r.referrer_user_id
    HAVING COUNT(*) FILTER (
      WHERE r.status IN ('ativou', 'engajado')
      AND COALESCE(r.engajou_at, r.ativou_at) >= v_period_start
      AND COALESCE(r.engajou_at, r.ativou_at) <  v_period_end
    ) > 0
  ),
  positioned AS (
    SELECT
      user_id,
      qualified_count,
      ROW_NUMBER() OVER (ORDER BY qualified_count DESC, first_qualified_at ASC) AS pos
    FROM ranked
  ),
  inserted AS (
    INSERT INTO monthly_ranking_snapshots (
      period_year, period_month, user_id, position,
      qualified_referrals_count, points_earned_in_period, prize_awarded
    )
    SELECT
      p_year, p_month, user_id, pos, qualified_count,
      (SELECT COALESCE(SUM(amount), 0) FROM points_ledger
       WHERE user_id = positioned.user_id
       AND reason IN ('referral_ativou', 'referral_engajado')
       AND created_at >= v_period_start AND created_at < v_period_end),
      CASE
        WHEN pos = 1 THEN 'R$ 200,00 (Top 1)'
        WHEN pos = 2 THEN 'R$ 100,00 (Top 2)'
        WHEN pos = 3 THEN 'R$ 50,00 (Top 3)'
        ELSE NULL
      END
    FROM positioned
    RETURNING user_id, position, qualified_referrals_count, prize_awarded
  )
  SELECT count(*) INTO v_inserted_count FROM inserted;

  -- Top 3 do snapshot pra retornar (cron usa pra disparar emails)
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'position', position,
    'qualified_count', qualified_referrals_count,
    'prize_awarded', prize_awarded
  ) ORDER BY position)
  INTO v_top3
  FROM monthly_ranking_snapshots
  WHERE period_year = p_year AND period_month = p_month AND position <= 3;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted_count', v_inserted_count,
    'top3', COALESCE(v_top3, '[]'::jsonb),
    'period_year', p_year,
    'period_month', p_month
  );
END;
$$;

COMMENT ON FUNCTION public.get_ranking IS 'Indique e Ganhe — top 20 do período + posição do user logado';
COMMENT ON FUNCTION public.snapshot_monthly_ranking IS 'Indique e Ganhe — cria snapshot imutável do ranking mensal (cron)';
