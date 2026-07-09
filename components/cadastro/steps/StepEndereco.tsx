'use client'

import { CadastroFormData } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

interface StepEnderecoProps {
  data: Partial<CadastroFormData>
  onUpdate: (data: Partial<CadastroFormData>) => void
  showValidation?: boolean
}

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function StepEndereco({ data, onUpdate, showValidation = false }: StepEnderecoProps) {
  const [localData, setLocalData] = useState({
    endereco: data.endereco || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    cidade: data.cidade || '',
    estado: data.estado || '',
    cep: data.cep || '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const next = { ...localData, [name]: value }
    setLocalData(next)
    onUpdate(next)
  }

  const handleBlur = () => {
    onUpdate(localData)
  }

  const formatCEP = (value: string) => {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9)
  }

  const isMissingField = (field: keyof typeof localData) =>
    showValidation && !String(localData[field] || '').trim()

  const inputClass = (field: keyof typeof localData) =>
    `mt-2 ${isMissingField(field) ? 'border-red-400 focus-visible:ring-red-500' : 'border-gray-300'}`

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="endereco" className="text-gray-700 font-medium">
          Endereço *
        </Label>
        <Input
          id="endereco"
          name="endereco"
          type="text"
          placeholder="Rua das Flores"
          value={localData.endereco}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          className={inputClass('endereco')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="numero" className="text-gray-700 font-medium">
            Número *
          </Label>
          <Input
            id="numero"
            name="numero"
            type="text"
            placeholder="123"
            value={localData.numero}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={inputClass('numero')}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="complemento" className="text-gray-700 font-medium">
            Complemento
          </Label>
          <Input
            id="complemento"
            name="complemento"
            type="text"
            placeholder="Apto 42"
            value={localData.complemento}
            onChange={handleChange}
            onBlur={handleBlur}
            className="mt-2 border-gray-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bairro" className="text-gray-700 font-medium">
            Bairro *
          </Label>
          <Input
            id="bairro"
            name="bairro"
            type="text"
            placeholder="Centro"
            value={localData.bairro}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={inputClass('bairro')}
          />
        </div>

        <div>
          <Label htmlFor="cep" className="text-gray-700 font-medium">
            CEP *
          </Label>
          <Input
            id="cep"
            name="cep"
            type="text"
            placeholder="00000-000"
            value={formatCEP(localData.cep)}
            onChange={(e) => {
              const formatted = formatCEP(e.target.value)
              const next = { ...localData, cep: formatted }
              setLocalData(next)
              onUpdate(next)
            }}
            onBlur={handleBlur}
            required
            className={inputClass('cep')}
            maxLength={9}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cidade" className="text-gray-700 font-medium">
            Cidade *
          </Label>
          <Input
            id="cidade"
            name="cidade"
            type="text"
            placeholder="São Paulo"
            value={localData.cidade}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={inputClass('cidade')}
          />
        </div>

        <div>
          <Label htmlFor="estado" className="text-gray-700 font-medium">
            Estado *
          </Label>
          <select
            id="estado"
            name="estado"
            value={localData.estado}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={`mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              isMissingField('estado')
                ? 'border-red-400 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          >
            <option value="">Selecione...</option>
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500">* Campo obrigatório</p>
    </div>
  )
}
