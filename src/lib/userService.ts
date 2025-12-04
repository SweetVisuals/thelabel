import { supabase } from './supabase';

export const userService = {
    async getPostizApiKey(userId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('postiz_api_key')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching Postiz API key:', error);
                return null;
            }

            return data?.postiz_api_key || null;
        } catch (error) {
            console.error('Error in getPostizApiKey:', error);
            return null;
        }
    },

    async updatePostizApiKey(userId: string, apiKey: string): Promise<{ success: boolean; error?: any }> {
        try {
            const { error } = await supabase
                .from('users')
                .update({ postiz_api_key: apiKey })
                .eq('id', userId);

            if (error) {
                console.error('Error updating Postiz API key:', error);
                return { success: false, error };
            }

            return { success: true };
        } catch (error) {
            console.error('Error in updatePostizApiKey:', error);
            return { success: false, error };
        }
    }
};
