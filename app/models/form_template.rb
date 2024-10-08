# frozen_string_literal: true

class FormTemplate < ActiveRecord::Base
  validates :name, presence: true, uniqueness: true, length: { maximum: 100 }
  validates :template, presence: true, length: { maximum: 2000 }
  validates_with FormTemplateYamlValidator
end

# == Schema Information
#
# Table name: form_templates
#
#  id         :bigint           not null, primary key
#  name       :string(100)      not null
#  template   :text             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_form_templates_on_name  (name) UNIQUE
#
