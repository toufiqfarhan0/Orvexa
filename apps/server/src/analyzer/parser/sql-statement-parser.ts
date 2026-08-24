import type { ParsedMigrationStatement } from '@orvexa/shared';

/**
 * Deterministic SQL statement tokenizer and operation extractor.
 * Parses raw PostgreSQL DDL scripts into structured parsed statement models.
 */
export class SqlStatementParser {
  /**
   * Splits a raw SQL script into individual statements safely,
   * respecting single quotes, dollar quotes ($$...$$), and SQL comments.
   */
  public static splitStatements(rawSql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;
    let dollarTag: string | null = null;

    let i = 0;
    const len = rawSql.length;

    while (i < len) {
      const char = rawSql[i];
      const nextChar = i + 1 < len ? rawSql[i + 1] : '';

      // Handle Line Comment (-- ...)
      if (inLineComment) {
        current += char;
        if (char === '\n') {
          inLineComment = false;
        }
        i++;
        continue;
      }

      // Handle Block Comment (/* ... */)
      if (inBlockComment) {
        current += char;
        if (char === '*' && nextChar === '/') {
          current += nextChar;
          inBlockComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }

      // Handle Single Quote ('...')
      if (inSingleQuote) {
        current += char;
        if (char === "'") {
          if (nextChar === "'") {
            // Escaped single quote
            current += nextChar;
            i += 2;
            continue;
          }
          inSingleQuote = false;
        }
        i++;
        continue;
      }

      // Handle Double Quote ("...")
      if (inDoubleQuote) {
        current += char;
        if (char === '"') {
          if (nextChar === '"') {
            current += nextChar;
            i += 2;
            continue;
          }
          inDoubleQuote = false;
        }
        i++;
        continue;
      }

      // Handle Dollar Quotes ($tag$...$tag$)
      if (dollarTag !== null) {
        current += char;
        if (char === '$' && rawSql.startsWith(dollarTag, i)) {
          current += dollarTag.slice(1);
          i += dollarTag.length;
          dollarTag = null;
          continue;
        }
        i++;
        continue;
      }

      // Check start of Line Comment
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        current += char + nextChar;
        i += 2;
        continue;
      }

      // Check start of Block Comment
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        current += char + nextChar;
        i += 2;
        continue;
      }

      // Check start of Single Quote
      if (char === "'") {
        inSingleQuote = true;
        current += char;
        i++;
        continue;
      }

      // Check start of Double Quote
      if (char === '"') {
        inDoubleQuote = true;
        current += char;
        i++;
        continue;
      }

      // Check start of Dollar Quote ($$...$$ or $tag$...$tag$)
      if (char === '$') {
        const dollarMatch = rawSql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
        if (dollarMatch && dollarMatch[1]) {
          dollarTag = dollarMatch[1];
          current += dollarTag;
          i += dollarTag.length;
          continue;
        }
      }

      // Check Statement Delimiter (;)
      if (char === ';') {
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        current = '';
        i++;
        continue;
      }

      current += char;
      i++;
    }

    const remaining = current.trim();
    if (remaining.length > 0) {
      statements.push(remaining);
    }

    return statements;
  }

  /**
   * Strips comments and normalizes internal whitespace for predictable parsing.
   */
  public static normalizeSql(sql: string): string {
    // Strip block comments
    let clean = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
    // Strip line comments
    clean = clean.replace(/--.*$/gm, ' ');
    // Collapse multiple whitespace
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  }

  /**
   * Parses schema and table name from a SQL identifier string (e.g. "public.users" or "users").
   */
  public static parseQualifiedIdentifier(
    rawIdentifier: string,
    defaultSchema: string = 'public'
  ): { schemaName: string; tableName: string } {
    const clean = rawIdentifier.replace(/["`]/g, '').trim();
    const parts = clean.split('.');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { schemaName: parts[0], tableName: parts[1] };
    }
    return { schemaName: defaultSchema, tableName: clean };
  }

  /**
   * Parses a single statement string into a structured ParsedMigrationStatement.
   */
  public static parseStatement(
    statementSql: string,
    statementIndex: number,
    defaultSchema: string = 'public'
  ): ParsedMigrationStatement {
    const normalized = this.normalizeSql(statementSql);
    const upper = normalized.toUpperCase();

    // 1. CREATE TABLE
    if (/^CREATE\s+(?:TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)?TABLE\b/i.test(upper)) {
      const ifNotExists = /IF\s+NOT\s+EXISTS\b/i.test(upper);
      const match = normalized.match(
        /^CREATE\s+(?:TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_."]+)/i
      );
      const target = match && match[1] ? match[1] : '';
      const { schemaName, tableName } = this.parseQualifiedIdentifier(target, defaultSchema);

      return {
        statementIndex,
        rawSql: statementSql,
        normalizedSql: normalized,
        operationType: 'CREATE_TABLE',
        schemaName,
        tableName,
        ifNotExists,
      };
    }

    // 2. DROP TABLE
    if (/^DROP\s+TABLE\b/i.test(upper)) {
      const ifExists = /IF\s+EXISTS\b/i.test(upper);
      const hasCascade = /\bCASCADE\b/i.test(upper);
      const match = normalized.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_."]+)/i);
      const target = match && match[1] ? match[1] : '';
      const { schemaName, tableName } = this.parseQualifiedIdentifier(target, defaultSchema);

      return {
        statementIndex,
        rawSql: statementSql,
        normalizedSql: normalized,
        operationType: 'DROP_TABLE',
        schemaName,
        tableName,
        ifExists,
        hasCascade,
      };
    }

    // 3. TRUNCATE TABLE
    if (/^TRUNCATE\s+(?:TABLE\s+)?/i.test(upper)) {
      const hasCascade = /\bCASCADE\b/i.test(upper);
      const match = normalized.match(/^TRUNCATE\s+(?:TABLE\s+)?([a-zA-Z0-9_."]+)/i);
      const target = match && match[1] ? match[1] : '';
      const { schemaName, tableName } = this.parseQualifiedIdentifier(target, defaultSchema);

      return {
        statementIndex,
        rawSql: statementSql,
        normalizedSql: normalized,
        operationType: 'TRUNCATE_TABLE',
        schemaName,
        tableName,
        hasCascade,
      };
    }

    // 4. CREATE INDEX / CREATE UNIQUE INDEX
    if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(upper)) {
      const isConcurrent = /\bCONCURRENTLY\b/i.test(upper);
      const ifNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(upper);

      // Match: CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] <indexName> ON <table> [USING ...] (<cols>)
      const indexMatch = normalized.match(
        /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_"]+)\s+ON\s+([a-zA-Z0-9_."]+)\s*(?:USING\s+[a-zA-Z0-9_]+\s*)?\(([^)]+)\)/i
      );

      if (indexMatch && indexMatch[1] && indexMatch[2] && indexMatch[3]) {
        const indexName = indexMatch[1].replace(/["`]/g, '');
        const targetTable = indexMatch[2];
        const rawCols = indexMatch[3];
        const columns = rawCols.split(',').map((c) => c.trim().replace(/["`]/g, ''));
        const { schemaName, tableName } = this.parseQualifiedIdentifier(targetTable, defaultSchema);

        return {
          statementIndex,
          rawSql: statementSql,
          normalizedSql: normalized,
          operationType: 'ADD_INDEX',
          schemaName,
          tableName,
          indexName,
          columns,
          isConcurrent,
          ifNotExists,
        };
      }

      return {
        statementIndex,
        rawSql: statementSql,
        normalizedSql: normalized,
        operationType: 'ADD_INDEX',
        isConcurrent,
        ifNotExists,
      };
    }

    // 5. DROP INDEX
    if (/^DROP\s+INDEX\b/i.test(upper)) {
      const isConcurrent = /\bCONCURRENTLY\b/i.test(upper);
      const ifExists = /\bIF\s+EXISTS\b/i.test(upper);
      const hasCascade = /\bCASCADE\b/i.test(upper);

      const match = normalized.match(
        /^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_."]+)/i
      );
      const indexTarget = match && match[1] ? match[1] : '';
      const { schemaName, tableName: indexName } = this.parseQualifiedIdentifier(
        indexTarget,
        defaultSchema
      );

      return {
        statementIndex,
        rawSql: statementSql,
        normalizedSql: normalized,
        operationType: 'DROP_INDEX',
        schemaName,
        indexName,
        isConcurrent,
        ifExists,
        hasCascade,
      };
    }

    // 6. ALTER TABLE
    if (/^ALTER\s+TABLE\b/i.test(upper)) {
      const tableMatch = normalized.match(
        /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([a-zA-Z0-9_."]+)\s+(.+)$/i
      );

      if (tableMatch && tableMatch[1] && tableMatch[2]) {
        const { schemaName, tableName } = this.parseQualifiedIdentifier(
          tableMatch[1],
          defaultSchema
        );
        const actionPart = tableMatch[2].trim();
        const actionUpper = actionPart.toUpperCase();

        // 6.1 ADD CONSTRAINT (FOREIGN KEY, CHECK, PRIMARY KEY, UNIQUE)
        if (
          /^ADD\s+(?:CONSTRAINT\s+[a-zA-Z0-9_"]+\s+)?(?:FOREIGN\s+KEY|CHECK|PRIMARY\s+KEY|UNIQUE)\b/i.test(
            actionUpper
          )
        ) {
          if (/\bFOREIGN\s+KEY\b/i.test(actionUpper)) {
            const fkMatch = actionPart.match(
              /^ADD\s+(?:CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_."]+)\s*(?:\(([^)]+)\))?(.*)$/i
            );
            const constraintName =
              fkMatch && fkMatch[1] ? fkMatch[1].replace(/["`]/g, '') : undefined;
            const columns =
              fkMatch && fkMatch[2]
                ? fkMatch[2].split(',').map((c) => c.trim().replace(/["`]/g, ''))
                : [];
            const referencedTable =
              fkMatch && fkMatch[3] ? fkMatch[3].trim().replace(/["`]/g, '') : undefined;
            const referencedColumns =
              fkMatch && fkMatch[4]
                ? fkMatch[4].split(',').map((c) => c.trim().replace(/["`]/g, ''))
                : [];
            const rest = fkMatch && fkMatch[5] ? fkMatch[5] : '';
            const isNotValid = /\bNOT\s+VALID\b/i.test(rest);

            return {
              statementIndex,
              rawSql: statementSql,
              normalizedSql: normalized,
              operationType: 'ADD_FOREIGN_KEY',
              schemaName,
              tableName,
              constraintName,
              columns,
              referencedTable,
              referencedColumns,
              isNotValid,
            };
          }

          if (/\bCHECK\b/i.test(actionUpper)) {
            const chkMatch = actionPart.match(
              /^ADD\s+(?:CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+)?CHECK\s*\((.*)\)(.*)$/i
            );
            const constraintName =
              chkMatch && chkMatch[1] ? chkMatch[1].replace(/["`]/g, '') : undefined;
            const rest = chkMatch && chkMatch[3] ? chkMatch[3] : '';
            const isNotValid = /\bNOT\s+VALID\b/i.test(rest);

            return {
              statementIndex,
              rawSql: statementSql,
              normalizedSql: normalized,
              operationType: 'ADD_CHECK_CONSTRAINT',
              schemaName,
              tableName,
              constraintName,
              isNotValid,
            };
          }

          if (/\bPRIMARY\s+KEY\b/i.test(actionUpper)) {
            const pkMatch = actionPart.match(
              /^ADD\s+(?:CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i
            );
            const constraintName =
              pkMatch && pkMatch[1] ? pkMatch[1].replace(/["`]/g, '') : undefined;
            const columns =
              pkMatch && pkMatch[2]
                ? pkMatch[2].split(',').map((c) => c.trim().replace(/["`]/g, ''))
                : [];

            return {
              statementIndex,
              rawSql: statementSql,
              normalizedSql: normalized,
              operationType: 'ADD_PRIMARY_KEY',
              schemaName,
              tableName,
              constraintName,
              columns,
            };
          }
        }

        // 6.2 DROP CONSTRAINT
        if (/^DROP\s+CONSTRAINT\b/i.test(actionUpper)) {
          const dropMatch = actionPart.match(
            /^DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)/i
          );
          const constraintName =
            dropMatch && dropMatch[1] ? dropMatch[1].replace(/["`]/g, '') : undefined;
          const hasCascade = /\bCASCADE\b/i.test(actionPart);
          const ifExists = /\bIF\s+EXISTS\b/i.test(actionPart);

          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'DROP_CONSTRAINT',
            schemaName,
            tableName,
            constraintName,
            hasCascade,
            ifExists,
          };
        }

        // 6.3 ADD COLUMN
        if (
          /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_"]+)\s+([a-zA-Z0-9_()]+(?:\s+\[\])?)/i.test(
            actionUpper
          )
        ) {
          const colMatch = actionPart.match(
            /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_"]+)\s+([a-zA-Z0-9_()]+(?:\s+\[\])?)(.*)$/i
          );
          const columnName = colMatch && colMatch[1] ? colMatch[1].replace(/["`]/g, '') : undefined;
          const newColumnType = colMatch && colMatch[2] ? colMatch[2].trim() : undefined;
          const rest = colMatch && colMatch[3] ? colMatch[3] : '';

          const isNotNull = /\bNOT\s+NULL\b/i.test(rest);
          const hasDefault = /\bDEFAULT\b/i.test(rest);
          const defaultMatch = rest.match(/\bDEFAULT\s+([^,]+)/i);
          const defaultValue = defaultMatch && defaultMatch[1] ? defaultMatch[1].trim() : undefined;
          const isGenerated = /\bGENERATED\s+ALWAYS\s+AS\b/i.test(rest);

          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'ADD_COLUMN',
            schemaName,
            tableName,
            columnName,
            newColumnType,
            isNotNull,
            hasDefault,
            defaultValue,
            isGenerated,
          };
        }

        // 6.4 DROP COLUMN
        if (/^DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)/i.test(actionUpper)) {
          const colMatch = actionPart.match(
            /^DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)(.*)$/i
          );
          const columnName = colMatch && colMatch[1] ? colMatch[1].replace(/["`]/g, '') : undefined;
          const hasCascade = /\bCASCADE\b/i.test(actionPart);
          const ifExists = /\bIF\s+EXISTS\b/i.test(actionPart);

          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'DROP_COLUMN',
            schemaName,
            tableName,
            columnName,
            hasCascade,
            ifExists,
          };
        }

        // 6.5 ALTER COLUMN TYPE
        if (
          /^ALTER\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+(?:SET\s+DATA\s+)?TYPE\s+([a-zA-Z0-9_()]+)/i.test(
            actionUpper
          )
        ) {
          const typeMatch = actionPart.match(
            /^ALTER\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+(?:SET\s+DATA\s+)?TYPE\s+([a-zA-Z0-9_()]+)/i
          );
          const columnName =
            typeMatch && typeMatch[1] ? typeMatch[1].replace(/["`]/g, '') : undefined;
          const newColumnType = typeMatch && typeMatch[2] ? typeMatch[2].trim() : undefined;

          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'ALTER_COLUMN_TYPE',
            schemaName,
            tableName,
            columnName,
            newColumnType,
          };
        }

        // 6.6 SET / DROP NOT NULL
        if (/^ALTER\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+SET\s+NOT\s+NULL/i.test(actionUpper)) {
          const match = actionPart.match(
            /^ALTER\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+SET\s+NOT\s+NULL/i
          );
          const columnName = match && match[1] ? match[1].replace(/["`]/g, '') : undefined;
          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'SET_NOT_NULL',
            schemaName,
            tableName,
            columnName,
            isNotNull: true,
          };
        }

        if (/^ALTER\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+DROP\s+NOT\s+NULL/i.test(actionUpper)) {
          const match = actionPart.match(
            /^ALTER\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+DROP\s+NOT\s+NULL/i
          );
          const columnName = match && match[1] ? match[1].replace(/["`]/g, '') : undefined;
          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'DROP_NOT_NULL',
            schemaName,
            tableName,
            columnName,
            isNotNull: false,
          };
        }

        // 6.7 RENAME COLUMN
        if (/^RENAME\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+TO\s+([a-zA-Z0-9_"]+)/i.test(actionUpper)) {
          const match = actionPart.match(
            /^RENAME\s+(?:COLUMN\s+)?([a-zA-Z0-9_"]+)\s+TO\s+([a-zA-Z0-9_"]+)/i
          );
          const columnName = match && match[1] ? match[1].replace(/["`]/g, '') : undefined;
          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'RENAME_COLUMN',
            schemaName,
            tableName,
            columnName,
          };
        }

        // 6.8 RENAME TABLE
        if (/^RENAME\s+TO\s+([a-zA-Z0-9_"]+)/i.test(actionUpper)) {
          return {
            statementIndex,
            rawSql: statementSql,
            normalizedSql: normalized,
            operationType: 'RENAME_TABLE',
            schemaName,
            tableName,
          };
        }
      }
    }

    // Fallback: Check for clearly unsupported / custom statements
    const isCustomDdl =
      /^(COMMENT\s+ON|GRANT|REVOKE|ALTER\s+SEQUENCE|CREATE\s+SEQUENCE|DROP\s+SEQUENCE|CREATE\s+VIEW|DROP\s+VIEW|CREATE\s+FUNCTION|DROP\s+FUNCTION|CREATE\s+TRIGGER|DROP\s+TRIGGER)\b/i.test(
        upper
      );

    return {
      statementIndex,
      rawSql: statementSql,
      normalizedSql: normalized,
      operationType: isCustomDdl ? 'CUSTOM_DDL' : 'UNSUPPORTED_OPERATION',
    };
  }

  /**
   * Splits a multi-statement SQL script and parses all statements into structured models.
   */
  public static parseScript(
    rawSql: string,
    defaultSchema: string = 'public'
  ): ParsedMigrationStatement[] {
    const statements = this.splitStatements(rawSql);
    return statements.map((stmt, idx) => this.parseStatement(stmt, idx, defaultSchema));
  }
}
