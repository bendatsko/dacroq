%Function that reads a cnf file and generate a SAT solution

% INPUT :
% V_k_hat - Partitions of variables
% k- The number of partitions
% Clauses - Matrix of clauses to be split locally and intermediately

% OUTPUT : 
% Clause_set - Set of clauses local to each partition
% Clause_inter - Set of clauses in the union of any partition
% clause_comm_nodes - Nodes in the clauses common to any or all partitions

function [Clause_set,Clause_inter,clause_comm_nodes] = clause_split(V_k_hat,K,Clauses)

set = cell(K,1);
all_union = unique([V_k_hat{:}]);

for i=1:K
    ind_set=[];
    V_i = V_k_hat{i};
    V_union = setdiff(all_union, V_i);

    for s1=1:size(Clauses,1)
        s2= abs(Clauses(s1,:));    
             
        if all(ismember(s2,V_i)) && ~all(ismember(s2,V_union))
            ind_set = [ind_set,s1];
        end
    end
    set{i} = ind_set;
end

all_clauses_ind = unique([set{:}]);
clause_com_num = setdiff([1:size(Clauses,1)], all_clauses_ind);

Clause_set = cellfun(@(x) Clauses(x, :),set,'UniformOutput',false);
Clause_inter = Clauses(clause_com_num,:);
clause_comm_nodes = unique(abs(Clause_inter))';

end