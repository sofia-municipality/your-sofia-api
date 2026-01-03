import type { Endpoint } from 'payload'

export const deleteAccount: Endpoint = {
  path: '/delete-account',
  method: 'delete',
  handler: async (req) => {
    const { payload, user } = req

    // Check if user is authenticated
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Security: Only allow users to delete their own account
    // The userId comes from the JWT token, not from request parameters
    // This ensures a user can only delete their own account
    const userId = (user as any).id

    try {
      // Fetch user from database to verify current role
      const userDoc = await payload.findByID({
        collection: 'users',
        id: userId,
      })

      // Check if user has admin role - admins cannot delete their accounts
      if (userDoc.role === 'admin') {
        return Response.json(
          { error: 'Admin accounts cannot be deleted' },
          { status: 403 }
        )
      }

      // Update user account: disable it and anonymize personal data
      await payload.update({
        collection: 'users',
        id: userId,
        data: {
          name: 'Deleted Account',
          email: `deleted-${userId}@deleted.account`,
          // Disable the account by setting a random password that cannot be used to login
          password: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
          // Note: Payload's auth system doesn't have a built-in "disabled" field,
          // but changing email to a non-existent one effectively prevents login
        },
      })

      return Response.json(
        {
          message: 'Account data deleted successfully',
          success: true,
          userId: userId,
        },
        { status: 200 }
      )
    } catch (error) {
      console.error('Error deleting account:', error)
      return Response.json(
        {
          error: 'Failed to delete account',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  },
}
