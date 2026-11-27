// Central permission catalogue + static role -> permission map.
// Enforcement happens in API middleware (src/lib/authz.ts), never only in the UI.

export const PERMISSIONS = {
  ADMIN_MANAGE: 'admin.manage',
  DOCUMENT_READ: 'document.read',
  DOCUMENT_REGISTER: 'document.register',
  DOCUMENT_REVISE: 'document.revise',
  PRINT_REQUEST: 'print.request',
  PRINT_APPROVE: 'print.approve',
  PRINT_ISSUE: 'print.issue',
  COPY_ISSUE: 'copy.issue',
  COPY_ACKNOWLEDGE: 'copy.acknowledge',
  COPY_VERIFY: 'copy.verify',
  COPY_INVENTORY_MANAGE: 'copy.inventory.manage',
  RECALL_INITIATE: 'recall.initiate',
  RECALL_CLOSE: 'recall.close',
  RECALL_EMERGENCY: 'recall.emergency',
  EXCEPTION_APPROVE: 'exception.approve',
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_NAMES = [
  'SYSTEM_ADMIN',
  'QA_HEAD',
  'DOCUMENT_CONTROLLER',
  'QA_MANAGER',
  'DEPARTMENT_HEAD',
  'EMPLOYEE',
  'AUDITOR',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  SYSTEM_ADMIN: Object.values(PERMISSIONS),
  QA_HEAD: [
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_REGISTER,
    PERMISSIONS.DOCUMENT_REVISE,
    PERMISSIONS.PRINT_APPROVE,
    PERMISSIONS.RECALL_INITIATE,
    PERMISSIONS.RECALL_CLOSE,
    PERMISSIONS.RECALL_EMERGENCY,
    PERMISSIONS.EXCEPTION_APPROVE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.COPY_INVENTORY_MANAGE,
  ],
  DOCUMENT_CONTROLLER: [
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_REGISTER,
    PERMISSIONS.DOCUMENT_REVISE,
    // MVP (Epic B, minimal): the Document Controller is the single
    // acknowledgment step — request -> controller, no separate QA-approve
    // role in this scope — so PRINT_APPROVE is granted here alongside
    // PRINT_ISSUE. The full configurable multi-step chain (QA_HEAD /
    // QA_MANAGER approving separately) is unchanged in the data model and
    // comes back in Phase 2.
    PERMISSIONS.PRINT_APPROVE,
    PERMISSIONS.PRINT_ISSUE,
    PERMISSIONS.COPY_ISSUE,
    PERMISSIONS.COPY_INVENTORY_MANAGE,
    PERMISSIONS.RECALL_INITIATE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.EXCEPTION_APPROVE,
  ],
  QA_MANAGER: [
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.PRINT_APPROVE,
    PERMISSIONS.EXCEPTION_APPROVE,
    PERMISSIONS.AUDIT_READ,
  ],
  DEPARTMENT_HEAD: [
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.PRINT_REQUEST,
    PERMISSIONS.COPY_ACKNOWLEDGE,
    PERMISSIONS.COPY_VERIFY,
    PERMISSIONS.COPY_INVENTORY_MANAGE,
  ],
  EMPLOYEE: [
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.PRINT_REQUEST,
    PERMISSIONS.COPY_ACKNOWLEDGE,
    PERMISSIONS.COPY_VERIFY,
  ],
  AUDITOR: [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.AUDIT_READ],
};

export function roleHasPermission(role: RoleName, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
