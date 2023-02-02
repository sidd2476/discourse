# frozen_string_literal: true

class AddIndexToPostsWhereNotDeletedOrEmpty < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def change
    add_index(
      :posts,
      %i[id topic_id],
      where: "deleted_at IS NULL AND raw <> ''",
      name: "index_posts_on_id_topic_id_where_not_deleted_or_empty",
      algorithm: :concurrently,
    )
  end
end
