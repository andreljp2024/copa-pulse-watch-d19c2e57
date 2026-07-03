export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_sync_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          message: string | null
          payload: Json | null
          source: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          source: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          gateway_pagamento: string | null
          id: string
          plano_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          gateway_pagamento?: string | null
          id?: string
          plano_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          gateway_pagamento?: string | null
          id?: string
          plano_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bolao_matches: {
        Row: {
          bolao_id: string
          created_at: string
          match_id: string
        }
        Insert: {
          bolao_id: string
          created_at?: string
          match_id: string
        }
        Update: {
          bolao_id?: string
          created_at?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bolao_matches_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bolao_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      boloes: {
        Row: {
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string
          data_limite_palpite: string | null
          descricao: string | null
          id: string
          logo_url: string | null
          nome: string
          percentual_admin: number
          permitir_ganhadores_publico: boolean
          permitir_ranking_publico: boolean
          regras: string | null
          slug: string
          status: string
          tenant_id: string
          updated_at: string
          valor_palpite: number
        }
        Insert: {
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          data_limite_palpite?: string | null
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          percentual_admin?: number
          permitir_ganhadores_publico?: boolean
          permitir_ranking_publico?: boolean
          regras?: string | null
          slug: string
          status?: string
          tenant_id: string
          updated_at?: string
          valor_palpite?: number
        }
        Update: {
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          data_limite_palpite?: string | null
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          percentual_admin?: number
          permitir_ganhadores_publico?: boolean
          permitir_ranking_publico?: boolean
          regras?: string | null
          slug?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_palpite?: number
        }
        Relationships: [
          {
            foreignKeyName: "boloes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_credentials: {
        Row: {
          api_key: string
          created_at: string
          gestor_id: string
          id: string
          instance_id: string
          qr_code: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          gestor_id: string
          id?: string
          instance_id: string
          qr_code?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          gestor_id?: string
          id?: string
          instance_id?: string
          qr_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ganhadores: {
        Row: {
          bolao_id: string
          created_at: string
          id: string
          match_id: string
          palpite_id: string
          tenant_id: string
          torcedor_id: string
        }
        Insert: {
          bolao_id: string
          created_at?: string
          id?: string
          match_id: string
          palpite_id: string
          tenant_id: string
          torcedor_id: string
        }
        Update: {
          bolao_id?: string
          created_at?: string
          id?: string
          match_id?: string
          palpite_id?: string
          tenant_id?: string
          torcedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ganhadores_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ganhadores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ganhadores_palpite_id_fkey"
            columns: ["palpite_id"]
            isOneToOne: false
            referencedRelation: "palpites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ganhadores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ganhadores_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "fraud_signals"
            referencedColumns: ["torcedor_id"]
          },
          {
            foreignKeyName: "ganhadores_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "torcedores"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          match_id: string
          minute: number
          player_id: string | null
          related_player_id: string | null
          team_id: string | null
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          match_id: string
          minute?: number
          player_id?: string | null
          related_player_id?: string | null
          team_id?: string | null
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          match_id?: string
          minute?: number
          player_id?: string | null
          related_player_id?: string | null
          team_id?: string | null
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_related_player_id_fkey"
            columns: ["related_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          id: string
          is_starter: boolean
          match_id: string
          player_id: string
          position: string | null
          shirt_number: number | null
          team_id: string
        }
        Insert: {
          id?: string
          is_starter?: boolean
          match_id: string
          player_id: string
          position?: string | null
          shirt_number?: number | null
          team_id: string
        }
        Update: {
          id?: string
          is_starter?: boolean
          match_id?: string
          player_id?: string
          position?: string | null
          shirt_number?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
        ]
      }
      match_statistics: {
        Row: {
          corners: number | null
          fouls: number | null
          id: string
          match_id: string
          offsides: number | null
          passes: number | null
          passes_accurate: number | null
          possession: number | null
          saves: number | null
          shots: number | null
          shots_on_target: number | null
          team_id: string
        }
        Insert: {
          corners?: number | null
          fouls?: number | null
          id?: string
          match_id: string
          offsides?: number | null
          passes?: number | null
          passes_accurate?: number | null
          possession?: number | null
          saves?: number | null
          shots?: number | null
          shots_on_target?: number | null
          team_id: string
        }
        Update: {
          corners?: number | null
          fouls?: number | null
          id?: string
          match_id?: string
          offsides?: number | null
          passes?: number | null
          passes_accurate?: number | null
          possession?: number | null
          saves?: number | null
          shots?: number | null
          shots_on_target?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_statistics_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_statistics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_statistics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
        ]
      }
      matches: {
        Row: {
          attendance: number | null
          away_score: number
          away_team_id: string
          created_at: string
          group_id: string | null
          home_score: number
          home_team_id: string
          id: string
          kickoff_at: string
          man_of_the_match: string | null
          phase: Database["public"]["Enums"]["match_phase"]
          referee_id: string | null
          stadium_id: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
        }
        Insert: {
          attendance?: number | null
          away_score?: number
          away_team_id: string
          created_at?: string
          group_id?: string | null
          home_score?: number
          home_team_id: string
          id?: string
          kickoff_at: string
          man_of_the_match?: string | null
          phase?: Database["public"]["Enums"]["match_phase"]
          referee_id?: string | null
          stadium_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Update: {
          attendance?: number | null
          away_score?: number
          away_team_id?: string
          created_at?: string
          group_id?: string | null
          home_score?: number
          home_team_id?: string
          id?: string
          kickoff_at?: string
          man_of_the_match?: string | null
          phase?: Database["public"]["Enums"]["match_phase"]
          referee_id?: string | null
          stadium_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_man_of_the_match_fkey"
            columns: ["man_of_the_match"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_stadium_id_fkey"
            columns: ["stadium_id"]
            isOneToOne: false
            referencedRelation: "stadiums"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          bolao_id: string | null
          created_at: string
          id: string
          mensagem: string
          numero_whatsapp: string
          palpite_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          tenant_id: string
          tentativas: number
          tipo: string
          torcedor_id: string | null
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          bolao_id?: string | null
          created_at?: string
          id?: string
          mensagem: string
          numero_whatsapp: string
          palpite_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          tentativas?: number
          tipo: string
          torcedor_id?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          bolao_id?: string | null
          created_at?: string
          id?: string
          mensagem?: string
          numero_whatsapp?: string
          palpite_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          tentativas?: number
          tipo?: string
          torcedor_id?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_palpite_id_fkey"
            columns: ["palpite_id"]
            isOneToOne: false
            referencedRelation: "palpites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "fraud_signals"
            referencedColumns: ["torcedor_id"]
          },
          {
            foreignKeyName: "notification_queue_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "torcedores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
        }
        Relationships: []
      }
      palpites: {
        Row: {
          bolao_id: string
          codigo: number
          comprovante_url: string | null
          created_at: string
          id: string
          match_id: string
          palpite_a: number
          palpite_b: number
          status_pagamento: string
          status_palpite: string
          tenant_id: string
          torcedor_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          bolao_id: string
          codigo?: number
          comprovante_url?: string | null
          created_at?: string
          id?: string
          match_id: string
          palpite_a: number
          palpite_b: number
          status_pagamento?: string
          status_palpite?: string
          tenant_id: string
          torcedor_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          bolao_id?: string
          codigo?: number
          comprovante_url?: string | null
          created_at?: string
          id?: string
          match_id?: string
          palpite_a?: number
          palpite_b?: number
          status_pagamento?: string
          status_palpite?: string
          tenant_id?: string
          torcedor_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "palpites_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "fraud_signals"
            referencedColumns: ["torcedor_id"]
          },
          {
            foreignKeyName: "palpites_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "torcedores"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          limite_boloes: number | null
          limite_palpites: number | null
          limite_torcedores: number | null
          nome: string
          permite_dominio_personalizado: boolean
          permite_exportacao: boolean
          permite_logo: boolean
          permite_whatsapp_api: boolean
          preco: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          limite_boloes?: number | null
          limite_palpites?: number | null
          limite_torcedores?: number | null
          nome: string
          permite_dominio_personalizado?: boolean
          permite_exportacao?: boolean
          permite_logo?: boolean
          permite_whatsapp_api?: boolean
          preco?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          limite_boloes?: number | null
          limite_palpites?: number | null
          limite_torcedores?: number | null
          nome?: string
          permite_dominio_personalizado?: boolean
          permite_exportacao?: boolean
          permite_logo?: boolean
          permite_whatsapp_api?: boolean
          preco?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string | null
          position: string | null
          shirt_number: number | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          bolao_id: string | null
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          torcedor_id: string | null
          user_agent: string | null
        }
        Insert: {
          auth: string
          bolao_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          torcedor_id?: string | null
          user_agent?: string | null
        }
        Update: {
          auth?: string
          bolao_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          torcedor_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "fraud_signals"
            referencedColumns: ["torcedor_id"]
          },
          {
            foreignKeyName: "push_subscriptions_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "torcedores"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          chave: string
          created_at: string
          escopo: string
          id: number
        }
        Insert: {
          chave: string
          created_at?: string
          escopo: string
          id?: number
        }
        Update: {
          chave?: string
          created_at?: string
          escopo?: string
          id?: number
        }
        Relationships: []
      }
      referees: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      scorers: {
        Row: {
          assists: number
          created_at: string
          goals: number
          id: string
          name: string
          nationality: string | null
          penalties: number
          team_code: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          assists?: number
          created_at?: string
          goals?: number
          id?: string
          name: string
          nationality?: string | null
          penalties?: number
          team_code: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          assists?: number
          created_at?: string
          goals?: number
          id?: string
          name?: string
          nationality?: string | null
          penalties?: number
          team_code?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
        ]
      }
      stadiums: {
        Row: {
          capacity: number | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          coach_name: string | null
          code: string
          confederation: string | null
          created_at: string
          fifa_rank: number | null
          flag_url: string | null
          group_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          coach_name?: string | null
          code: string
          confederation?: string | null
          created_at?: string
          fifa_rank?: number | null
          flag_url?: string | null
          group_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          coach_name?: string | null
          code?: string
          confederation?: string | null
          created_at?: string
          fifa_rank?: number | null
          flag_url?: string | null
          group_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_pix_config: {
        Row: {
          banco: string | null
          chave_pix: string
          cidade: string | null
          created_at: string
          id: string
          instrucoes_pagamento: string | null
          nome_recebedor: string
          numero_recebedor_whatsapp: string | null
          tenant_id: string
          tipo_chave_pix: string
          updated_at: string
          valor_padrao_palpite: number
        }
        Insert: {
          banco?: string | null
          chave_pix: string
          cidade?: string | null
          created_at?: string
          id?: string
          instrucoes_pagamento?: string | null
          nome_recebedor: string
          numero_recebedor_whatsapp?: string | null
          tenant_id: string
          tipo_chave_pix: string
          updated_at?: string
          valor_padrao_palpite?: number
        }
        Update: {
          banco?: string | null
          chave_pix?: string
          cidade?: string | null
          created_at?: string
          id?: string
          instrucoes_pagamento?: string | null
          nome_recebedor?: string
          numero_recebedor_whatsapp?: string | null
          tenant_id?: string
          tipo_chave_pix?: string
          updated_at?: string
          valor_padrao_palpite?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_pix_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_whatsapp_config: {
        Row: {
          created_at: string
          evolution_api_key: string | null
          evolution_base_url: string | null
          evolution_instance: string | null
          id: string
          integracao_modo: string
          mensagem_confirmacao_pagamento: string | null
          mensagem_ganhador: string | null
          mensagem_lembrete_pagamento: string | null
          mensagem_novo_palpite: string | null
          numero_whatsapp: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_instance?: string | null
          id?: string
          integracao_modo?: string
          mensagem_confirmacao_pagamento?: string | null
          mensagem_ganhador?: string | null
          mensagem_lembrete_pagamento?: string | null
          mensagem_novo_palpite?: string | null
          numero_whatsapp: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_instance?: string | null
          id?: string
          integracao_modo?: string
          mensagem_confirmacao_pagamento?: string | null
          mensagem_ganhador?: string | null
          mensagem_lembrete_pagamento?: string | null
          mensagem_novo_palpite?: string | null
          numero_whatsapp?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_whatsapp_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          estado: string | null
          id: string
          logo_url: string | null
          logradouro: string | null
          nome_estabelecimento: string
          nome_responsavel: string
          numero: string | null
          owner_user_id: string
          plano: string
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          estado?: string | null
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          nome_estabelecimento: string
          nome_responsavel: string
          numero?: string | null
          owner_user_id: string
          plano?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          estado?: string | null
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          nome_estabelecimento?: string
          nome_responsavel?: string
          numero?: string | null
          owner_user_id?: string
          plano?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      torcedores: {
        Row: {
          bloqueado: boolean
          bolao_id: string
          created_at: string
          id: string
          nome: string
          tenant_id: string
          token_acesso_hash: string | null
          whatsapp: string
        }
        Insert: {
          bloqueado?: boolean
          bolao_id: string
          created_at?: string
          id?: string
          nome: string
          tenant_id: string
          token_acesso_hash?: string | null
          whatsapp: string
        }
        Update: {
          bloqueado?: boolean
          bolao_id?: string
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          token_acesso_hash?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "torcedores_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torcedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      fraud_signals: {
        Row: {
          bloqueado: boolean | null
          bolao_id: string | null
          nome: string | null
          pendentes: number | null
          torcedor_id: string | null
          total_palpites: number | null
          ultimos_10min: number | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "torcedores_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_ranking_torcedores: {
        Row: {
          acertos_exatos: number | null
          acertos_resultado: number | null
          bolao_id: string | null
          nome: string | null
          pontos: number | null
          refreshed_at: string | null
          torcedor_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "palpites_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "fraud_signals"
            referencedColumns: ["torcedor_id"]
          },
          {
            foreignKeyName: "palpites_torcedor_id_fkey"
            columns: ["torcedor_id"]
            isOneToOne: false
            referencedRelation: "torcedores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_standings: {
        Row: {
          code: string | null
          draws: number | null
          flag_url: string | null
          goal_diff: number | null
          goals_against: number | null
          goals_for: number | null
          group_id: string | null
          losses: number | null
          name: string | null
          played: number | null
          points: number | null
          team_id: string | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      v_top_scorers: {
        Row: {
          assists: number | null
          flag_url: string | null
          goals: number | null
          name: string | null
          nationality: string | null
          penalties: number | null
          player_id: string | null
          team_code: string | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scorers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_standings"
            referencedColumns: ["team_id"]
          },
        ]
      }
    }
    Functions: {
      apurar_ganhadores_para_match: {
        Args: { p_match_id: string }
        Returns: number
      }
      check_rate_limit: {
        Args: {
          p_chave: string
          p_escopo: string
          p_janela_segundos: number
          p_max: number
        }
        Returns: boolean
      }
      consultar_palpites_por_whatsapp: {
        Args: { p_slug: string; p_whatsapp: string }
        Returns: {
          away_flag: string
          away_team: string
          codigo: number
          created_at: string
          ganhou: boolean
          home_flag: string
          home_team: string
          kickoff_at: string
          match_status: string
          nome_torcedor: string
          palpite_a: number
          palpite_b: number
          placar_a: number
          placar_b: number
          status_pagamento: string
          valor: number
        }[]
      }
      current_tenant_id: { Args: never; Returns: string }
      get_bolao_public_payment: {
        Args: { p_slug: string }
        Returns: {
          banco: string
          chave_pix: string
          mensagem_novo_palpite: string
          nome_recebedor: string
          numero_recebedor_whatsapp: string
          numero_whatsapp: string
          valor_padrao_palpite: number
        }[]
      }
      get_bolao_ranking: {
        Args: { p_slug: string }
        Returns: {
          acertos_exatos: number
          acertos_resultado: number
          nome: string
          pontos: number
          torcedor_id: string
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_ranking: { Args: never; Returns: undefined }
      submit_palpite: {
        Args: {
          p_bolao_id: string
          p_match_id: string
          p_nome: string
          p_palpite_a: number
          p_palpite_b: number
          p_whatsapp: string
        }
        Returns: {
          codigo: number
          palpite_id: string
        }[]
      }
      upsert_whatsapp_config: {
        Args: {
          p_mensagem_confirmacao_pagamento?: string
          p_mensagem_ganhador?: string
          p_mensagem_lembrete_pagamento?: string
          p_mensagem_novo_palpite?: string
          p_numero_whatsapp: string
          p_tenant_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "tenant_admin"
      event_type:
        | "goal"
        | "own_goal"
        | "penalty"
        | "yellow_card"
        | "red_card"
        | "substitution"
      match_phase:
        | "group"
        | "round_of_32"
        | "round_of_16"
        | "quarter"
        | "semi"
        | "third_place"
        | "final"
      match_status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "super_admin", "tenant_admin"],
      event_type: [
        "goal",
        "own_goal",
        "penalty",
        "yellow_card",
        "red_card",
        "substitution",
      ],
      match_phase: [
        "group",
        "round_of_32",
        "round_of_16",
        "quarter",
        "semi",
        "third_place",
        "final",
      ],
      match_status: ["scheduled", "live", "finished", "postponed", "cancelled"],
    },
  },
} as const
