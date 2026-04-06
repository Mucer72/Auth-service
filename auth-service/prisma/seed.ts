import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create permissions
  const permissions = [
    // User permissions
    { name: 'users:read', resource: 'users', action: 'read', description: 'Read user information' },
    { name: 'users:create', resource: 'users', action: 'create', description: 'Create new users' },
    { name: 'users:update', resource: 'users', action: 'update', description: 'Update user information' },
    { name: 'users:delete', resource: 'users', action: 'delete', description: 'Delete users' },

    // Role permissions
    { name: 'roles:read', resource: 'roles', action: 'read', description: 'Read role information' },
    { name: 'roles:create', resource: 'roles', action: 'create', description: 'Create new roles' },
    { name: 'roles:update', resource: 'roles', action: 'update', description: 'Update role information' },
    { name: 'roles:delete', resource: 'roles', action: 'delete', description: 'Delete roles' },

    // Permission permissions
    { name: 'permissions:read', resource: 'permissions', action: 'read', description: 'Read permission information' },
    { name: 'permissions:create', resource: 'permissions', action: 'create', description: 'Create new permissions' },
    { name: 'permissions:update', resource: 'permissions', action: 'update', description: 'Update permission information' },
    { name: 'permissions:delete', resource: 'permissions', action: 'delete', description: 'Delete permissions' },
  ];

  console.log('📝 Creating permissions...');
  const createdPermissions = await Promise.all(
    permissions.map(permission =>
      prisma.permission.upsert({
        where: { name: permission.name },
        update: {},
        create: permission,
      })
    )
  );

  // Create roles
  console.log('👥 Creating roles...');
  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Basic user role with limited permissions',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator role with full permissions',
    },
  });

  // Assign permissions to roles
  console.log('🔗 Assigning permissions to roles...');

  // User role permissions (limited)
  const userPermissions = createdPermissions.filter(p =>
    ['users:read', 'users:update'].includes(p.name)
  );

  await Promise.all(
    userPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: userRole.id,
          permissionId: permission.id,
        },
      })
    )
  );

  // Admin role permissions (all permissions)
  await Promise.all(
    createdPermissions.map(permission =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      })
    )
  );

  console.log('✅ Database seeding completed successfully!');
  console.log(`📊 Created ${createdPermissions.length} permissions`);
  console.log(`👥 Created ${userRole.name} and ${adminRole.name} roles`);
  console.log(`🔗 Assigned ${userPermissions.length} permissions to ${userRole.name} role`);
  console.log(`🔗 Assigned ${createdPermissions.length} permissions to ${adminRole.name} role`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });