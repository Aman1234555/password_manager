import { getUserById, listAuditForUser, listSuspiciousAudit, listUsers as dbListUsers } from '../db.js';

// Admin can view users, but NEVER see vault plaintext (server never has it).
export async function listUsers(_req, res) {
  try {
    const users = await dbListUsers();
    res.json({ users });
  } catch (error) {
    console.error('Error in listUsers controller:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getUserProfile(req, res) {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const audit = await listAuditForUser(user.id, 50);
    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      },
      audit
    });
  } catch (error) {
    console.error('Error in getUserProfile controller:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listSuspicious(_req, res) {
  try {
    const events = await listSuspiciousAudit(50);
    res.json({ events });
  } catch (error) {
    console.error('Error in listSuspicious controller:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
