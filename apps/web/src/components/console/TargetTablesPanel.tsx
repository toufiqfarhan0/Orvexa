import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Columns,
  Key,
  Database,
  ArrowsClockwise,
  MagnifyingGlass,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';
import type {
  TargetTableInspection,
  SchemaDiffResult,
  MigrationRehearsalEvidence,
  TableMetadata,
  ColumnMetadata,
} from '@orvexa/shared';
import { migrationApi } from '../../services/migration-api.service.js';

export interface TargetTablesPanelProps {
  evidence?: MigrationRehearsalEvidence | null;
  schemaDiff?: SchemaDiffResult | null;
  currentSql?: string;
  onRefresh?: () => void;
  isOpen?: boolean;
}

export function formatDataType(dataType: string, udtName?: string): string {
  if (udtName) {
    const udt = udtName.toLowerCase();
    if (udt === 'timestamptz') return 'timestamptz';
    if (udt === 'timestamp') return 'timestamp';
    if (udt === 'int4') return 'integer';
    if (udt === 'int8') return 'bigint';
    if (udt === 'int2') return 'smallint';
    if (udt === 'bool') return 'boolean';
    if (udt === 'varchar') return 'varchar';
    if (udt === 'float8') return 'float8';
    if (udt === 'float4') return 'float4';
    if (udt === 'text') return 'text';
    if (udt === 'uuid') return 'uuid';
    if (udt === 'jsonb') return 'jsonb';
    if (udt === 'json') return 'json';
  }
  const dt = (dataType || '').toLowerCase();
  if (dt === 'timestamp with time zone') return 'timestamptz';
  if (dt === 'timestamp without time zone') return 'timestamp';
  if (dt.startsWith('character varying')) return 'varchar';
  if (dt === 'double precision') return 'float8';
  return dataType || 'unknown';
}

export const TargetTablesPanel: React.FC<TargetTablesPanelProps> = ({
  evidence,
  schemaDiff,
  onRefresh,
}) => {
  const [tables, setTables] = useState<TargetTableInspection[]>([]);
  const [dbName, setDbName] = useState<string>('schemasentry_test');
  const [schemaName, setSchemaName] = useState<string>('public');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  const activeDiff = evidence?.schemaDifferences || schemaDiff;

  // Extract change maps for quick badge lookup
  const diffMaps = useMemo(() => {
    const getTableName = (t: TableMetadata | string): string =>
      typeof t === 'string' ? t : t.tableName || '';

    const addedTablesSet = new Set(
      (activeDiff?.tables?.added || []).map((t) => getTableName(t).toLowerCase()).filter(Boolean)
    );
    const removedTablesSet = new Set(
      (activeDiff?.tables?.removed || []).map((t) => getTableName(t).toLowerCase()).filter(Boolean)
    );
    const modifiedTablesSet = new Set(
      (activeDiff?.tables?.modified || [])
        .map((t) => (t.name || (t as { before?: TableMetadata }).before?.tableName || '').toLowerCase())
        .filter(Boolean)
    );

    const addedColsSet = new Set(
      (activeDiff?.columns?.added || []).map((c) => (c.columnName || '').toLowerCase()).filter(Boolean)
    );
    const removedColsSet = new Set(
      (activeDiff?.columns?.removed || []).map((c) => (c.columnName || '').toLowerCase()).filter(Boolean)
    );
    const modifiedColsSet = new Set(
      (activeDiff?.columns?.modified || [])
        .map((c) => (c.name || (c as { before?: ColumnMetadata }).before?.columnName || '').toLowerCase())
        .filter(Boolean)
    );

    return {
      addedTablesSet,
      removedTablesSet,
      modifiedTablesSet,
      addedColsSet,
      removedColsSet,
      modifiedColsSet,
    };
  }, [activeDiff]);

  const loadTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await migrationApi.fetchTargetTables();
      if (result.success && result.data) {
        const data = result.data;
        setTables(data.tables || []);
        if (data.database) setDbName(data.database);
        if (data.schema) setSchemaName(data.schema);
        // Automatically expand the first table if available
        if (data.tables && data.tables.length > 0) {
          const firstTable = data.tables[0];
          setExpandedTables((prev) => ({
            ...prev,
            [firstTable.tableName]: true,
          }));
        }
      } else {
        setError(result.error || 'Failed to inspect target database tables.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Database inspection connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, [evidence?.rehearsalId, evidence?.status]);

  const toggleTableExpand = (tableName: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [tableName]: !prev[tableName],
    }));
  };

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase().trim();
    return tables.filter(
      (t) =>
        t.tableName.toLowerCase().includes(q) ||
        t.columns.some((c) => c.columnName.toLowerCase().includes(q))
    );
  }, [tables, searchQuery]);

  return (
    <div className="c-card" style={{ marginTop: '1rem' }}>
      {/* Panel Header */}
      <div className="c-card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="c-icon-box">
            <Table size={16} color="var(--accent)" weight="bold" />
          </div>
          <div>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Database Tables & Schema
            </h3>
            <div
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginTop: '0.1rem',
              }}
            >
              {schemaName}.{dbName}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              loadTables();
              if (onRefresh) onRefresh();
            }}
            className="btn btn-outline"
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.6875rem',
              gap: '0.3rem',
            }}
            title="Refresh database schema catalog"
          >
            <ArrowsClockwise size={12} className={loading ? 'icon-spin' : ''} />
            <span>Refresh</span>
          </button>

          <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
            {tables.length} {tables.length === 1 ? 'TABLE' : 'TABLES'}
          </span>
        </div>
      </div>

      <div className="c-card-body" style={{ padding: '1rem' }}>
        {/* Search Bar */}
        {tables.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg-recessed)',
              border: '1px solid var(--border-dim)',
              borderRadius: '8px',
              padding: '0.4rem 0.75rem',
              marginBottom: '1rem',
            }}
          >
            <MagnifyingGlass size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Filter tables or columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && tables.length === 0 && (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}
          >
            <ArrowsClockwise size={20} className="icon-spin" style={{ marginBottom: '0.5rem' }} />
            <div>Querying PostgreSQL catalog...</div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && tables.length === 0 && (
          <div
            className="console-notice notice-warn"
            style={{ margin: 0, padding: '0.75rem 1rem' }}
          >
            <div style={{ fontSize: '0.75rem' }}>
              <strong>Could not inspect database:</strong> {error}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tables.length === 0 && (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              background: 'var(--bg-recessed)',
              borderRadius: '12px',
              border: '1px dashed var(--border-dim)',
            }}
          >
            <Database size={28} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.25rem',
              }}
            >
              No User Tables in Schema '{schemaName}'
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                maxWidth: '280px',
                margin: '0 auto',
              }}
            >
              Run a <code>CREATE TABLE</code> migration script to provision your initial PostgreSQL
              table fixtures.
            </div>
          </div>
        )}

        {/* Table List Accordion */}
        {filteredTables.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filteredTables.map((tbl: TargetTableInspection) => {
              const tableNameLower = tbl.tableName.toLowerCase();
              const isExpanded = Boolean(expandedTables[tbl.tableName]);
              const isAddedTable = diffMaps.addedTablesSet.has(tableNameLower);
              const isRemovedTable = diffMaps.removedTablesSet.has(tableNameLower);
              const isModifiedTable = diffMaps.modifiedTablesSet.has(tableNameLower);

              const hasColChanges = (tbl.columns || []).some((c: ColumnMetadata) =>
                diffMaps.addedColsSet.has(c.columnName.toLowerCase()) ||
                diffMaps.removedColsSet.has(c.columnName.toLowerCase()) ||
                diffMaps.modifiedColsSet.has(c.columnName.toLowerCase())
              );

              return (
                <div
                  key={tbl.tableName}
                  style={{
                    background: isAddedTable
                      ? 'var(--green-bg)'
                      : isModifiedTable || hasColChanges
                        ? 'var(--accent-light)'
                        : isRemovedTable
                          ? 'var(--red-bg)'
                          : 'var(--bg-surface)',
                    border: `1px solid ${
                      isAddedTable
                        ? 'var(--green-border)'
                        : isModifiedTable || hasColChanges
                          ? 'var(--accent-border-strong)'
                          : isRemovedTable
                            ? 'var(--red-border)'
                            : 'var(--border-dim)'
                    }`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    transition: 'all 150ms ease',
                  }}
                >
                  {/* Table Header Bar */}
                  <div
                    onClick={() => toggleTableExpand(tbl.tableName)}
                    style={{
                      padding: '0.65rem 0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: 'transparent',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        minWidth: 0,
                      }}
                    >
                      <Table
                        size={15}
                        color={
                          isAddedTable
                            ? 'var(--green)'
                            : isModifiedTable || hasColChanges
                              ? 'var(--accent)'
                              : 'var(--text-secondary)'
                        }
                        weight="bold"
                      />
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {tbl.tableName}
                      </span>

                      {/* Migration Status Badges */}
                      {isAddedTable && (
                        <span
                          className="badge badge-green"
                          style={{
                            fontSize: '0.5625rem',
                            padding: '0.1rem 0.4rem',
                            fontWeight: 800,
                          }}
                        >
                          + NEW TABLE
                        </span>
                      )}
                      {isModifiedTable && !isAddedTable && (
                        <span
                          className="badge badge-blue"
                          style={{
                            fontSize: '0.5625rem',
                            padding: '0.1rem 0.4rem',
                            fontWeight: 800,
                          }}
                        >
                          ~ ALTERED
                        </span>
                      )}
                      {isRemovedTable && (
                        <span
                          className="badge badge-red"
                          style={{
                            fontSize: '0.5625rem',
                            padding: '0.1rem 0.4rem',
                            fontWeight: 800,
                          }}
                        >
                          - DROPPED
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {tbl.columns.length} cols
                      </span>
                      {isExpanded ? (
                        <CaretUp size={12} weight="bold" color="var(--text-muted)" />
                      ) : (
                        <CaretDown size={12} weight="bold" color="var(--text-muted)" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Columns & Constraints Sub-View */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '0 0.875rem 0.875rem 0.875rem',
                        borderTop: '1px solid var(--border-faint)',
                        background: '#ffffff',
                      }}
                    >
                      {/* Column Table */}
                      <div style={{ marginTop: '0.5rem' }}>
                        <div
                          style={{
                            fontSize: '0.625rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.35rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>COLUMN DEFINITION</span>
                          <span>DATA TYPE & RULES</span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                          }}
                        >
                          {(tbl.columns || []).map((col: ColumnMetadata) => {
                            const colNameLower = col.columnName.toLowerCase();
                            const isColAdded = diffMaps.addedColsSet.has(colNameLower);
                            const isColRemoved = diffMaps.removedColsSet.has(colNameLower);
                            const isColModified = diffMaps.modifiedColsSet.has(colNameLower);

                            // Check if this column is part of Primary Key
                            const isPk = (tbl.constraints || []).some(
                              (c: { type?: string; columnNames?: string[] }) =>
                                c.type === 'PRIMARY KEY' &&
                                (c.columnNames || []).some(
                                  (cn: string) => cn.toLowerCase() === colNameLower
                                )
                            );

                            return (
                              <div
                                key={col.columnName}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.625rem',
                                  padding: '0.4rem 0.55rem',
                                  borderRadius: '6px',
                                  background: isColAdded
                                    ? 'var(--green-bg)'
                                    : isColModified
                                      ? 'var(--amber-bg)'
                                      : isColRemoved
                                        ? 'var(--red-bg)'
                                        : 'var(--bg-recessed)',
                                  border: `1px solid ${
                                    isColAdded
                                      ? 'var(--green-border)'
                                      : isColModified
                                        ? 'var(--amber-border)'
                                        : isColRemoved
                                          ? 'var(--red-border)'
                                          : 'var(--border-subtle)'
                                  }`,
                                  fontSize: '0.75rem',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    minWidth: 0,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {isPk ? (
                                    <Key
                                      size={11}
                                      color="var(--accent)"
                                      weight="fill"
                                      style={{ flexShrink: 0 }}
                                    />
                                  ) : (
                                    <Columns
                                      size={11}
                                      color="var(--text-muted)"
                                      style={{ flexShrink: 0 }}
                                    />
                                  )}
                                  <span
                                    style={{
                                      fontWeight: isPk || isColAdded ? 700 : 500,
                                      color: isColAdded
                                        ? 'var(--green)'
                                        : isColRemoved
                                          ? 'var(--red)'
                                          : isPk
                                            ? 'var(--accent-text)'
                                            : 'var(--text-primary)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {col.columnName}
                                  </span>

                                  {isColAdded && (
                                    <span
                                      className="badge badge-green"
                                      style={{
                                        fontSize: '0.5rem',
                                        padding: '0.05rem 0.3rem',
                                        flexShrink: 0,
                                      }}
                                    >
                                      + ADDED
                                    </span>
                                  )}
                                  {isColModified && (
                                    <span
                                      className="badge badge-amber"
                                      style={{
                                        fontSize: '0.5rem',
                                        padding: '0.05rem 0.3rem',
                                        flexShrink: 0,
                                      }}
                                    >
                                      ~ MODIFIED
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    fontSize: '0.6875rem',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                    {formatDataType(col.dataType, col.udtName)}
                                  </span>
                                  {!col.isNullable && (
                                    <span
                                      style={{
                                        color: 'var(--text-muted)',
                                        fontSize: '0.5625rem',
                                        fontWeight: 600,
                                        background: 'var(--bg-elevated)',
                                        padding: '0.1rem 0.3rem',
                                        borderRadius: '3px',
                                        border: '1px solid var(--border-subtle)',
                                        letterSpacing: '0.03em',
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      NOT NULL
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Indexes Sub-Section */}
                      {(tbl.indexes || []).length > 0 && (
                        <div style={{ marginTop: '0.625rem' }}>
                          <div
                            style={{
                              fontSize: '0.625rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              marginBottom: '0.25rem',
                            }}
                          >
                            INDEXES ({tbl.indexes.length})
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.35rem',
                            }}
                          >
                            {tbl.indexes.map((idx: { indexName: string; isPrimary?: boolean }) => (
                              <span
                                key={idx.indexName}
                                style={{
                                  fontSize: '0.625rem',
                                  fontFamily: 'var(--font-mono)',
                                  background: 'var(--bg-recessed)',
                                  border: '1px solid var(--border-subtle)',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {idx.isPrimary ? '🔑 ' : '⚡ '}
                                {idx.indexName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
