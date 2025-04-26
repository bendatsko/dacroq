% Function that accepts the smaller splits of the problem and returns the
% SAT solution of the big problem

% Input : 
% parts - Partitions for large problem
% node_set - Nodes for all partitions
% Clause_set - Clauses local to all partitions
% Clause_inter - Common Clauses for both chips
% clause_comm_nodes - Nodes present in the Clause_inter
% S: # of nodes
% Clauses : Set of all Clauses

%Output : 
% X_final : The final SAT states for all the variables 
% sat_time : Array to store the max time to reach sat solution for chip1
% and chip2 for an initial X
% flip_time : Array to store flipping time of the nodes based on k1 and k2 of the
% algorithm for an initial X 
% total_time : Array to store the total time to reach a SAT solution for
% the larger problem


function [X_final,sat_time,flip_time,total_time]=chip_solver_large(parts,node_set,Clause_set,Clause_inter,clause_comm_nodes,S,Clauses)


node_set = cellfun(@sort, node_set, 'UniformOutput', false);
clause_comm_nodes = sort(clause_comm_nodes);


o_node_set = cellfun(@(x) [1:length(x)],node_set,'UniformOutput',false);
o_clause_comm_nodes = 1:size(clause_comm_nodes,2);

map = cellfun(@(x, y) [x', y'], node_set, o_node_set, 'UniformOutput', false);
map_inter = [clause_comm_nodes', o_clause_comm_nodes'];

for k=1:parts
    [rows, cols] = size(Clause_set{k});
    for i = 1:rows
        for j = 1:cols
            if Clause_set{k}(i,j)<0
                Clause_set{k}(i,j)=-map{k}(find(map{k}(:, 1) == abs(Clause_set{k}(i,j))),2);
            else
                Clause_set{k}(i,j)=map{k}(find(map{k}(:, 1) == Clause_set{k}(i,j)),2);
            end
        end
    end
end


[rows, cols] = size(Clause_inter);
for i = 1:rows
    for j = 1:cols
        if Clause_inter(i,j)<0
            Clause_inter(i,j)=-map_inter(find(map_inter(:, 1) == abs(Clause_inter(i,j))),2);
        else
            Clause_inter(i,j)=map_inter(find(map_inter(:, 1) == Clause_inter(i,j)),2);
        end
    end
end


K=10^6;
VC=1;
small_eps=0.00;
X_final=binornd(ones(S,1),0.5); % Uniformly generating initial state
vtmpb=100;
c=1;
time=zeros(1,parts);
total_time=[];
unsatis_arr=[0,0,0,0,0,0,0,0,0];
flip_node_arr=cell(1,10);
X_arr={};

% Simulating for K jumps
while(vtmpb~=0)

    X_sat=cell(1,parts);
    parfor p =1:parts

        [X,TvalV] = MCMC_small_solver(S,K,VC,small_eps,X_final,node_set,Clause_set,p);

        X_sat{p} = X;
        time(p)=TvalV(end);
    end

    for k=1:parts
        X_final(map{k}(:,1))=X_sat{k};
    end

    
    X_inter = X_final(clause_comm_nodes);

    [vtmpx,vtmpb]=rnode_chip(size(X_inter,1),X_inter,small_eps,Clause_inter,size(Clause_inter,1));

    [~,vtmpt]=rnode_chip(size(X_final,1),X_final,small_eps,Clauses,size(Clauses,1));


    if vtmpb==0
        disp("Solution found");
        [~,vtmpt]=rnode_chip(size(X_final,1),X_final,small_eps,Clauses,size(Clauses,1));
        break;
    end

    tic;


    X_i = X_final;
    n = size(X_i, 1);
    cl_matrix=zeros(S,S);

    % for i = 1:S
    %     X_i(i) = 1 - X_final(i); % Flip the bit
    %     [cl_matrix(i,:), cl_unsatis(i)] = rnode_chip(n, X_i, small_eps, Clauses, size(Clauses, 1));
    %     X_i(i) = X_final(i); % Restore original value
    % end

    % The following calculates the CMAT matrix once that was required in the above rnode_chip to calculate
    % evertime before. Then new function rnode_MCMC does not require to
    % calculate the CMAT
    C= size(Clauses,1);
    CMat_all=zeros(C,S);
    for j=1:S
        for k=1:C
            if(any(Clauses(k,:)==j))
                CMat_all(k,j)=1;
            end
            if(any(Clauses(k,:)==-j))
                CMat_all(k,j)=-1;
            end
        end
    end
    parfor i = 1:S
        X_i_temp = X_final;  
        X_i_temp(i) = 1 - X_i_temp(i); % Flip the bit
        [cl_matrix(i,:), cl_unsatis(i)] = rnode_MCMC(n, X_i_temp, small_eps, CMat_all, C);
    end

    unsatis_arr= [unsatis_arr,vtmpt];
    [~,flip_nodes] = find(cl_unsatis<vtmpt);
    flip_node_arr{end+1}= flip_nodes;

    flip_node_arr = flip_node_arr(end-9:end);

    if all(cellfun(@(x) isequal(x, flip_node_arr{1}), flip_node_arr)) || all(unsatis_arr(end-4:end) == unsatis_arr(end))
        X_final=binornd(ones(S,1),0.5);
        continue;
    end

    if isempty(flip_nodes)

        [~,equal] = find(cl_unsatis==vtmpt);

        if ~isempty(equal)
            new_flip_nodes = equal;

            % for i = equal
            %     I_minus = find(cl_matrix(i,[1:i-1,i+1:end]) > 0);
            %     new_flip_nodes = union(new_flip_nodes, I_minus);
            % end

            % Used parfor here for faster calculation
            numEqual = numel(equal);
            new_flip_nodes_cell = cell(1, numEqual); % Preallocate cell array

            parfor idx = 1:numEqual
                i = equal(idx);
                I_minus = find(cl_matrix(i, [1:i-1, i+1:end]) > 0);
                new_flip_nodes_cell{idx} = I_minus;
            end
            % Merge results after the parallel loop
            new_flip_nodes = unique(cell2mat(new_flip_nodes_cell));

            n = length(new_flip_nodes);
            idx = randperm(n, floor(n/2));
            flip_nodes = new_flip_nodes(idx);

        else
            X_final=binornd(ones(S,1),0.5);
            continue;
        end

    end
    X_final(flip_nodes)= 1- X_final(flip_nodes);

    % This part checks whether we have reached to a state before, if it has
    % then resets the X_final vector to avoid reaching a local minimum
    exists = any(cellfun(@(x) isequal(x, X_final), X_arr));
    
    % Keep generating a new X_final until it is unique
    while exists
        X_final = binornd(ones(S,1), 0.5); % Generate again
        exists = any(cellfun(@(x) isequal(x, X_final), X_arr));
    end
    X_arr{end+1} = X_final;

    % Calculating solver and flip times for each iteration
    sat_time(c) = max(time);
    flip_time(c)=toc;
    total_time(c) = sat_time(c)+flip_time(c);
    c=c+1;


end

end
