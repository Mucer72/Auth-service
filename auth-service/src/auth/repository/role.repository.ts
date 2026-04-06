import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type CreateRoleInput = {
  name: string;
  description?: string;
};

type UpdateRoleInput = {
  name?: string;
  description?: string;
};

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CRUD Operations ====================

  async createRole(data: CreateRoleInput) {
    return this.prisma.role.create({
      data,
    });
  }

  async findRoleById(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
    });
  }

  async findRoleByName(name: string) {
    return this.prisma.role.findUnique({
      where: { name },
    });
  }

  async getAllRoles() {
    return this.prisma.role.findMany();
  }

  async updateRole(id: string, data: UpdateRoleInput) {
    return this.prisma.role.update({
      where: { id },
      data,
    });
  }

  async deleteRole(id: string) {
    return this.prisma.role.delete({
      where: { id },
    });
  }

  // ==================== Helper Functions ====================

  /**
   * Get role ID by name
   * @param name - The name of the role
   * @returns The role ID or null if not found
   */
  async getIdByName(name: string): Promise<string | null> {
    const role = await this.prisma.role.findUnique({
      where: { name },
      select: { id: true },
    });
    return role?.id || null;
  }

  /**
   * Get role name by ID
   * @param id - The ID of the role
   * @returns The role name or null if not found
   */
  async getNameById(id: string): Promise<string | null> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { name: true },
    });
    return role?.name || null;
  }

  /**
   * Check if a role exists by name
   * @param name - The name of the role
   * @returns True if role exists, false otherwise
   */
  async roleExists(name: string): Promise<boolean> {
    const role = await this.prisma.role.findUnique({
      where: { name },
    });
    return !!role;
  }

  /**
   * Check if a role exists by ID
   * @param id - The ID of the role
   * @returns True if role exists, false otherwise
   */
  async roleExistsById(id: string): Promise<boolean> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    return !!role;
  }

  /**
   * Get role with all its permissions
   * @param roleId - The ID of the role
   * @returns Role object with permissions or null if not found
   */
  async getRolePermissions(roleId: string) {
    return this.prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: true,
      },
    });
  }

  async getRolePermissionNames(roleId: string): Promise<string[]> {
    const perms = await this.getRolePermissions(roleId);
    return perms.map((rp) => rp.permission.name);
  }

  async getRoleWithPermissions(roleId: string) {
    const role = await this.findRoleById(roleId);
    if (!role) return null;

    const permissions = await this.getRolePermissions(roleId);
    return {
      ...role,
      permissions,
    };
  }

  /**
   * Get role with all its users
   * @param roleId - The ID of the role
   * @returns Role object with users or null if not found
   */
  async getRoleWithUsers(roleId: string) {
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        users: true,
      },
    });
  }

  /**
   * Get role with permissions and users
   * @param roleId - The ID of the role
   * @returns Role object with permissions and users or null if not found
   */
  async getRoleWithRelations(roleId: string) {
    const role = await this.getRoleWithUsers(roleId);
    if (!role) return null;

    const permissions = await this.getRolePermissions(roleId);
    return {
      ...role,
      permissions,
    };
  }

  /**
   * Get all roles with their permissions
   * @returns Array of role objects with permissions
   */
  async getAllRolesWithPermissions() {
    const roles = await this.getAllRoles();

    const roleIds = roles.map((r) => r.id);
    const allPermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });

    return roles.map((role) => ({
      ...role,
      permissions: allPermissions.filter((rp) => rp.roleId === role.id),
    }));
  }

  /**
   * Count total number of roles
   * @returns Total count of roles
   */
  async countRoles(): Promise<number> {
    return this.prisma.role.count();
  }

  /**
   * Count users with a specific role
   * @param roleId - The ID of the role
   * @returns Count of users with the role
   */
  async countUsersByRole(roleId: string): Promise<number> {
    return this.prisma.user.count({
      where: { roleId },
    });
  }

  /**
   * Get roles paginated
   * @param skip - Number of roles to skip
   * @param take - Number of roles to take
   * @returns Array of role objects
   */
  async getRolesPaginated(skip: number, take: number) {
    return this.prisma.role.findMany({
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Check if role name is unique (excluding a specific role by ID)
   * @param name - The name to check
   * @param excludeId - ID to exclude from check (for update operations)
   * @returns True if unique, false otherwise
   */
  async isRoleNameUnique(name: string, excludeId?: string): Promise<boolean> {
    const role = await this.prisma.role.findUnique({
      where: { name },
      select: { id: true },
    });

    if (!role) return true;
    if (excludeId && role.id === excludeId) return true;
    return false;
  }
}
